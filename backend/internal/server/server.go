package server

import (
	"errors"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"educonnect/internal/auth"
	"educonnect/internal/chat"
	"educonnect/internal/db"
	"educonnect/internal/middleware"
	"educonnect/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	roleAdmin   = "administrator"
	roleTeacher = "teacher"
	roleStudent = "student"

	serverTypeTeachers  = "teachers"
	serverTypeCommunity = "community"
	serverTypeClass     = "class"

	channelTypeChat  = "chat"
	channelTypeFiles = "files"

	maxUploadSize = 100 << 20
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type messageRequest struct {
	Content string `json:"content"`
}

type createUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Password string `json:"password"`
	ClassIDs []uint `json:"classIds"`
}

type createServerRequest struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	ClassID     *uint  `json:"classId"`
	ClassName   string `json:"className"`
	TeacherIDs  []uint `json:"teacherIds"`
	StudentIDs  []uint `json:"studentIds"`
	MemberIDs   []uint `json:"memberIds"`
}

type addMembersRequest struct {
	UserIDs []uint `json:"userIds"`
}

func Start() {
	dbConn, err := db.Open()
	if err != nil {
		panic(err)
	}
	if err := migrate(dbConn); err != nil {
		panic(err)
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		panic(err)
	}

	seedData(dbConn, uploadDir)

	authService := auth.NewService(dbConn, auth.GetJWTSecret(), auth.GetRefreshSecret())
	hub := chat.NewHub()
	go hub.Run()

	router := gin.New()
	router.MaxMultipartMemory = maxUploadSize
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware())
	router.Static("/uploads", uploadDir)

	router.POST("/api/auth/login", func(c *gin.Context) {
		var body loginRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email et mot de passe requis"})
			return
		}

		user, err := authService.Authenticate(strings.TrimSpace(strings.ToLower(body.Email)), body.Password)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "identifiants invalides"})
			return
		}

		accessToken, refreshToken, err := authService.GenerateTokens(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de générer les jetons"})
			return
		}

		if err := authService.StoreRefreshToken(user.ID, refreshToken, time.Now().Add(7*24*time.Hour)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur de serveur"})
			return
		}

		c.SetCookie("refresh_token", refreshToken, int(7*24*time.Hour.Seconds()), "/", "", false, true)
		c.JSON(http.StatusOK, gin.H{
			"accessToken":  accessToken,
			"refreshToken": refreshToken,
			"user": gin.H{
				"id":    user.ID,
				"name":  user.Name,
				"email": user.Email,
				"role":  user.Role,
			},
			"role": user.Role,
			"name": user.Name,
		})
	})

	router.POST("/api/auth/refresh", func(c *gin.Context) {
		var body refreshRequest
		refreshToken := c.GetHeader("X-Refresh-Token")
		if refreshToken == "" {
			if err := c.ShouldBindJSON(&body); err == nil {
				refreshToken = body.RefreshToken
			}
		}
		if refreshToken == "" {
			refreshToken, _ = c.Cookie("refresh_token")
		}
		if refreshToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton de rafraîchissement requis"})
			return
		}

		token, err := authService.ValidateRefreshToken(refreshToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "rafraîchissement invalide"})
			return
		}

		user, err := authService.GetUserByID(token.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "utilisateur introuvable"})
			return
		}

		if err := authService.RevokeRefreshToken(refreshToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur interne"})
			return
		}

		accessToken, newRefreshToken, err := authService.GenerateTokens(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de générer les jetons"})
			return
		}

		if err := authService.StoreRefreshToken(user.ID, newRefreshToken, time.Now().Add(7*24*time.Hour)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur de serveur"})
			return
		}

		c.SetCookie("refresh_token", newRefreshToken, int(7*24*time.Hour.Seconds()), "/", "", false, true)
		c.JSON(http.StatusOK, gin.H{"accessToken": accessToken, "refreshToken": newRefreshToken})
	})

	router.POST("/api/auth/logout", func(c *gin.Context) {
		refreshToken, _ := c.Cookie("refresh_token")
		if refreshToken != "" {
			_ = authService.RevokeRefreshToken(refreshToken)
		}
		c.SetCookie("refresh_token", "", -1, "/", "", false, true)
		c.JSON(http.StatusOK, gin.H{"message": "déconnecté"})
	})

	apiGroup := router.Group("/api")
	apiGroup.Use(middleware.JWTAuth(authService))
	{
		apiGroup.GET("/profile", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"profile": currentUser(c)})
		})

		apiGroup.GET("/users", func(c *gin.Context) {
			if !isAdmin(currentUser(c)) {
				c.JSON(http.StatusForbidden, gin.H{"error": "réservé aux administrateurs"})
				return
			}
			var users []models.User
			if err := dbConn.Order("role asc, name asc").Find(&users).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les utilisateurs"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"users": users})
		})

		apiGroup.POST("/users", func(c *gin.Context) {
			user := currentUser(c)
			if !isAdmin(user) {
				c.JSON(http.StatusForbidden, gin.H{"error": "réservé aux administrateurs"})
				return
			}

			var body createUserRequest
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "données utilisateur invalides"})
				return
			}

			created, err := createUser(dbConn, body)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, gin.H{"user": created})
		})

		apiGroup.GET("/servers", func(c *gin.Context) {
			user := currentUser(c)
			var servers []models.ChatServer
			query := dbConn.
				Preload("Owner").
				Preload("Class").
				Preload("Channels", func(tx *gorm.DB) *gorm.DB {
					return tx.Order("channels.created_at asc")
				}).
				Preload("Members.User").
				Order("type asc, name asc")

			if isAdmin(user) {
				if err := query.Find(&servers).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les serveurs"})
					return
				}
			} else if err := query.
				Joins("JOIN server_members ON server_members.server_id = chat_servers.id AND server_members.deleted_at IS NULL").
				Where("server_members.user_id = ?", user.ID).
				Find(&servers).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les serveurs"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"servers": servers})
		})

		apiGroup.POST("/servers", func(c *gin.Context) {
			user := currentUser(c)
			if !isAdmin(user) {
				c.JSON(http.StatusForbidden, gin.H{"error": "seul l'administrateur peut créer un serveur"})
				return
			}

			var body createServerRequest
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "données serveur invalides"})
				return
			}

			server, err := createServer(dbConn, user, body)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if err := dbConn.Preload("Owner").Preload("Class").Preload("Channels").Preload("Members.User").First(&server, server.ID).Error; err != nil {
				c.JSON(http.StatusCreated, gin.H{"server": server})
				return
			}
			c.JSON(http.StatusCreated, gin.H{"server": server})
		})

		apiGroup.GET("/servers/:id/members", func(c *gin.Context) {
			user := currentUser(c)
			serverID, ok := parseUintParam(c, "id")
			if !ok {
				return
			}
			if !canAccessServer(dbConn, user, serverID) {
				c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
				return
			}

			var members []models.ServerMember
			if err := dbConn.Preload("User").Where("server_id = ?", serverID).Order("role asc, created_at asc").Find(&members).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les membres"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"members": members})
		})

		apiGroup.POST("/servers/:id/members", func(c *gin.Context) {
			user := currentUser(c)
			if !isAdmin(user) {
				c.JSON(http.StatusForbidden, gin.H{"error": "réservé aux administrateurs"})
				return
			}
			serverID, ok := parseUintParam(c, "id")
			if !ok {
				return
			}
			var body addMembersRequest
			if err := c.ShouldBindJSON(&body); err != nil || len(body.UserIDs) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "sélectionnez au moins un utilisateur"})
				return
			}

			if err := addMembersToServer(dbConn, serverID, body.UserIDs); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "membres ajoutés"})
		})

		apiGroup.GET("/classes", func(c *gin.Context) {
			user := currentUser(c)
			var classes []models.Class
			query := dbConn.Preload("Channels").Order("name asc")
			if isAdmin(user) {
				if err := query.Find(&classes).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les classes"})
					return
				}
			} else if err := query.
				Joins("JOIN class_members ON class_members.class_id = classes.id AND class_members.deleted_at IS NULL").
				Where("class_members.user_id = ?", user.ID).
				Find(&classes).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les classes"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"classes": classes})
		})

		apiGroup.GET("/classes/:id/channels", func(c *gin.Context) {
			user := currentUser(c)
			classID, ok := parseUintParam(c, "id")
			if !ok {
				return
			}
			if !isAdmin(user) && !isClassMember(dbConn, user.ID, classID, "") {
				c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
				return
			}
			var channels []models.Channel
			if err := dbConn.Where("class_id = ?", classID).Order("created_at asc").Find(&channels).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les canaux"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"channels": channels})
		})

		apiGroup.GET("/channels/:id/messages", func(c *gin.Context) {
			user := currentUser(c)
			channel, ok := loadAccessibleChannel(c, dbConn, user)
			if !ok {
				return
			}
			var messages []models.Message
			if err := dbConn.Where("channel_id = ?", channel.ID).Order("created_at asc").Find(&messages).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les messages"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"messages": messages})
		})

		apiGroup.POST("/channels/:id/messages", func(c *gin.Context) {
			user := currentUser(c)
			channel, ok := loadAccessibleChannel(c, dbConn, user)
			if !ok {
				return
			}
			if channel.Type != channelTypeChat {
				c.JSON(http.StatusBadRequest, gin.H{"error": "ce canal n'accepte pas les messages"})
				return
			}

			var body messageRequest
			content := ""
			if err := c.ShouldBindJSON(&body); err == nil {
				content = strings.TrimSpace(body.Content)
			}
			if content == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "le contenu du message est requis"})
				return
			}

			message := models.Message{
				ChannelID: channel.ID,
				AuthorID:  user.ID,
				Author:    user.Name,
				Role:      user.Role,
				Content:   content,
			}
			if err := dbConn.Create(&message).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible d'enregistrer le message"})
				return
			}

			wsMessage := chat.Message{
				ID:     fmt.Sprintf("msg-%d", message.ID),
				Room:   strconv.FormatUint(uint64(channel.ID), 10),
				Author: message.Author,
				Role:   message.Role,
				Text:   message.Content,
				Time:   message.CreatedAt.Format("15:04"),
			}
			chat.AddMessage(wsMessage)
			hub.BroadcastMessage(wsMessage)
			c.JSON(http.StatusCreated, gin.H{"message": message})
		})

		apiGroup.GET("/channels/:id/files", func(c *gin.Context) {
			user := currentUser(c)
			channel, ok := loadAccessibleChannel(c, dbConn, user)
			if !ok {
				return
			}
			if channel.Type != channelTypeFiles {
				c.JSON(http.StatusBadRequest, gin.H{"error": "ce canal n'est pas un espace fichiers"})
				return
			}

			var files []models.FileResource
			if err := dbConn.Where("channel_id = ?", channel.ID).Order("created_at desc").Find(&files).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les fichiers"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"files": files, "canUpload": canUploadFile(dbConn, user, channel)})
		})

		apiGroup.POST("/channels/:id/files", func(c *gin.Context) {
			user := currentUser(c)
			channel, ok := loadAccessibleChannel(c, dbConn, user)
			if !ok {
				return
			}
			if !canUploadFile(dbConn, user, channel) {
				c.JSON(http.StatusForbidden, gin.H{"error": "seuls les professeurs assignés et l'administrateur peuvent envoyer des fichiers"})
				return
			}

			file, err := c.FormFile("file")
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "fichier requis"})
				return
			}
			if file.Size > maxUploadSize {
				c.JSON(http.StatusBadRequest, gin.H{"error": "fichier trop volumineux"})
				return
			}

			resource, err := saveUploadedFile(c, uploadDir, dbConn, channel, user)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, gin.H{"file": resource})
		})

		apiGroup.GET("/files", func(c *gin.Context) {
			user := currentUser(c)
			var files []models.FileResource
			query := dbConn.Order("created_at desc")
			if isAdmin(user) {
				if err := query.Find(&files).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les fichiers"})
					return
				}
			} else if err := query.
				Joins("JOIN server_members ON server_members.server_id = file_resources.server_id AND server_members.deleted_at IS NULL").
				Where("server_members.user_id = ?", user.ID).
				Find(&files).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les fichiers"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"files": files})
		})

		apiGroup.GET("/announcements", func(c *gin.Context) {
			var announcements []models.Announcement
			if err := dbConn.Order("created_at desc").Find(&announcements).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les annonces"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"announcements": announcements})
		})

		apiGroup.GET("/meetings", func(c *gin.Context) {
			var meetings []models.Meeting
			if err := dbConn.Order("starts_at asc").Find(&meetings).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de charger les réunions"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"meetings": meetings})
		})
	}

	router.GET("/ws/chat", func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "token query param requis"})
			return
		}

		user, err := authService.ParseAccessToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "jeton invalide"})
			return
		}

		connection, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := chat.NewClient(connection, auth.User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role})
		hub.RegisterClient(client)
		go client.WritePump()
		client.ReadPump(hub)
	})

	fmt.Println("Backend démarré sur http://localhost:8000")
	if err := router.Run(":8000"); err != nil {
		panic(err)
	}
}

func migrate(dbConn *gorm.DB) error {
	return dbConn.AutoMigrate(
		&models.User{},
		&models.RefreshToken{},
		&models.Class{},
		&models.ChatServer{},
		&models.ServerMember{},
		&models.ClassMember{},
		&models.Channel{},
		&models.Message{},
		&models.Announcement{},
		&models.FileResource{},
		&models.Meeting{},
	)
}

func createUser(dbConn *gorm.DB, body createUserRequest) (*models.User, error) {
	name := strings.TrimSpace(body.Name)
	email := strings.TrimSpace(strings.ToLower(body.Email))
	role := normalizeRole(body.Role)
	password := strings.TrimSpace(body.Password)
	if name == "" || email == "" || role == "" {
		return nil, errors.New("nom, email et rôle sont requis")
	}
	if password == "" {
		password = "ChangeMe123!"
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, errors.New("impossible de préparer le mot de passe")
	}
	user := &models.User{Name: name, Email: email, Role: role, PasswordHash: hash}
	err = dbConn.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return errors.New("cet email est déjà utilisé")
		}
		for _, classID := range body.ClassIDs {
			memberRole := role
			if role == roleAdmin {
				continue
			}
			if err := ensureClassMember(tx, classID, user.ID, memberRole); err != nil {
				return err
			}
			var server models.ChatServer
			if err := tx.Where("class_id = ?", classID).First(&server).Error; err == nil {
				if err := ensureServerMember(tx, server, *user); err != nil {
					return err
				}
			}
		}
		return nil
	})
	return user, err
}

func createServer(dbConn *gorm.DB, user *auth.User, body createServerRequest) (models.ChatServer, error) {
	name := strings.TrimSpace(body.Name)
	serverType := normalizeServerType(body.Type)
	description := strings.TrimSpace(body.Description)
	if name == "" {
		return models.ChatServer{}, errors.New("le nom du serveur est requis")
	}
	if serverType == "" {
		return models.ChatServer{}, errors.New("type de serveur invalide")
	}
	if description == "" {
		description = "Espace de communication interne."
	}

	var server models.ChatServer
	err := dbConn.Transaction(func(tx *gorm.DB) error {
		var classID *uint
		if serverType == serverTypeClass {
			class, err := resolveClassForServer(tx, body)
			if err != nil {
				return err
			}
			classID = &class.ID
		}

		server = models.ChatServer{
			Name:        name,
			Slug:        uniqueSlug(tx, slugify(name), &models.ChatServer{}),
			Type:        serverType,
			Description: description,
			OwnerID:     user.ID,
			ClassID:     classID,
		}
		if err := tx.Create(&server).Error; err != nil {
			return errors.New("impossible de créer le serveur")
		}
		if err := ensureDefaultChannels(tx, server); err != nil {
			return err
		}

		var admin models.User
		if err := tx.First(&admin, user.ID).Error; err == nil {
			if err := ensureServerMember(tx, server, admin); err != nil {
				return err
			}
		}

		userIDs := mergeUserIDs(body.MemberIDs, body.TeacherIDs, body.StudentIDs)
		if err := addMembersToServerTx(tx, server, userIDs); err != nil {
			return err
		}
		return nil
	})
	return server, err
}

func resolveClassForServer(tx *gorm.DB, body createServerRequest) (models.Class, error) {
	var class models.Class
	if body.ClassID != nil && *body.ClassID > 0 {
		if err := tx.First(&class, *body.ClassID).Error; err != nil {
			return class, errors.New("classe introuvable")
		}
		return class, nil
	}

	className := strings.TrimSpace(body.ClassName)
	if className == "" {
		className = strings.TrimSpace(body.Name)
	}
	if className == "" {
		return class, errors.New("le nom de la classe est requis")
	}

	slug := slugify(className)
	err := tx.Where("slug = ?", slug).First(&class).Error
	if err == nil {
		return class, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return class, errors.New("impossible de vérifier la classe")
	}

	class = models.Class{
		Name:        className,
		Slug:        uniqueSlug(tx, slug, &models.Class{}),
		Description: "Classe active de l'établissement.",
	}
	if err := tx.Create(&class).Error; err != nil {
		return class, errors.New("impossible de créer la classe")
	}
	return class, nil
}

func addMembersToServer(dbConn *gorm.DB, serverID uint, userIDs []uint) error {
	var server models.ChatServer
	if err := dbConn.Preload("Class").First(&server, serverID).Error; err != nil {
		return errors.New("serveur introuvable")
	}
	return dbConn.Transaction(func(tx *gorm.DB) error {
		return addMembersToServerTx(tx, server, userIDs)
	})
}

func addMembersToServerTx(tx *gorm.DB, server models.ChatServer, userIDs []uint) error {
	for _, userID := range userIDs {
		var member models.User
		if err := tx.First(&member, userID).Error; err != nil {
			return errors.New("utilisateur introuvable")
		}
		if err := ensureServerMember(tx, server, member); err != nil {
			return err
		}
		if server.Type == serverTypeClass && server.ClassID != nil && member.Role != roleAdmin {
			if err := ensureClassMember(tx, *server.ClassID, member.ID, member.Role); err != nil {
				return err
			}
		}
	}
	return nil
}

func ensureServerMember(tx *gorm.DB, server models.ChatServer, user models.User) error {
	if server.Type == serverTypeTeachers && user.Role == roleStudent {
		return fmt.Errorf("%s est étudiant et ne peut pas rejoindre le serveur profs", user.Name)
	}
	role := user.Role
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.ServerMember{
		ServerID: server.ID,
		UserID:   user.ID,
		Role:     role,
	}).Error
}

func ensureClassMember(tx *gorm.DB, classID, userID uint, role string) error {
	if role != roleTeacher && role != roleStudent {
		return nil
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.ClassMember{
		ClassID: classID,
		UserID:  userID,
		Role:    role,
	}).Error
}

func ensureDefaultChannels(tx *gorm.DB, server models.ChatServer) error {
	if server.Type == serverTypeClass {
		if err := ensureChannel(tx, server, "Message global", channelTypeChat, "Discussion de la classe."); err != nil {
			return err
		}
		return ensureChannel(tx, server, "Fichiers", channelTypeFiles, "Documents partagés par les professeurs.")
	}

	if err := ensureChannel(tx, server, "Général", channelTypeChat, "Discussion interne."); err != nil {
		return err
	}
	return ensureChannel(tx, server, "Fichiers", channelTypeFiles, "Documents du serveur.")
}

func ensureChannel(tx *gorm.DB, server models.ChatServer, name, channelType, description string) error {
	var existing models.Channel
	query := tx.Where("server_id = ? AND name = ?", server.ID, name).First(&existing)
	if query.Error == nil {
		return nil
	}
	if !errors.Is(query.Error, gorm.ErrRecordNotFound) {
		return query.Error
	}

	channel := models.Channel{
		ServerID:    server.ID,
		ClassID:     server.ClassID,
		Name:        name,
		Type:        channelType,
		Description: description,
	}
	return tx.Create(&channel).Error
}

func loadAccessibleChannel(c *gin.Context, dbConn *gorm.DB, user *auth.User) (models.Channel, bool) {
	channelID, ok := parseUintParam(c, "id")
	if !ok {
		return models.Channel{}, false
	}

	var channel models.Channel
	if err := dbConn.Preload("Server").First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "canal introuvable"})
		return models.Channel{}, false
	}
	if !canAccessServer(dbConn, user, channel.ServerID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "accès refusé"})
		return models.Channel{}, false
	}
	return channel, true
}

func saveUploadedFile(c *gin.Context, uploadDir string, dbConn *gorm.DB, channel models.Channel, user *auth.User) (models.FileResource, error) {
	file, err := c.FormFile("file")
	if err != nil {
		return models.FileResource{}, errors.New("fichier requis")
	}

	originalName := filepath.Base(file.Filename)
	if originalName == "." || originalName == string(filepath.Separator) {
		originalName = fmt.Sprintf("fichier-%d", time.Now().Unix())
	}
	safeName := sanitizeFileName(originalName)
	storedName := fmt.Sprintf("%d-%s", time.Now().UnixNano(), safeName)
	storagePath := filepath.Join(uploadDir, storedName)
	if err := c.SaveUploadedFile(file, storagePath); err != nil {
		return models.FileResource{}, errors.New("impossible d'enregistrer le fichier")
	}

	fileType := strings.TrimPrefix(strings.ToUpper(filepath.Ext(originalName)), ".")
	if fileType == "" {
		fileType = "FILE"
	}
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(originalName))
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	resource := models.FileResource{
		ServerID:     channel.ServerID,
		ChannelID:    channel.ID,
		ClassID:      channel.ClassID,
		Name:         originalName,
		Type:         fileType,
		Size:         formatBytes(file.Size),
		SizeBytes:    file.Size,
		MIMEType:     mimeType,
		URL:          "/uploads/" + storedName,
		StoragePath:  storagePath,
		UploadedByID: user.ID,
		UploadedBy:   user.Name,
	}
	if err := dbConn.Create(&resource).Error; err != nil {
		return models.FileResource{}, errors.New("impossible d'enregistrer les métadonnées du fichier")
	}
	return resource, nil
}

func canUploadFile(dbConn *gorm.DB, user *auth.User, channel models.Channel) bool {
	if channel.Type != channelTypeFiles {
		return false
	}
	if user.Role == roleAdmin {
		return true
	}
	if user.Role != roleTeacher {
		return false
	}
	if channel.Server.Type == serverTypeClass && channel.Server.ClassID != nil {
		return isClassMember(dbConn, user.ID, *channel.Server.ClassID, roleTeacher)
	}
	return true
}

func canAccessServer(dbConn *gorm.DB, user *auth.User, serverID uint) bool {
	if isAdmin(user) {
		return true
	}
	var count int64
	dbConn.Model(&models.ServerMember{}).
		Where("server_id = ? AND user_id = ?", serverID, user.ID).
		Count(&count)
	return count > 0
}

func isClassMember(dbConn *gorm.DB, userID, classID uint, role string) bool {
	query := dbConn.Model(&models.ClassMember{}).Where("class_id = ? AND user_id = ?", classID, userID)
	if role != "" {
		query = query.Where("role = ?", role)
	}
	var count int64
	query.Count(&count)
	return count > 0
}

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	value, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || value == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "identifiant invalide"})
		return 0, false
	}
	return uint(value), true
}

func currentUser(c *gin.Context) *auth.User {
	return c.MustGet("user").(*auth.User)
}

func isAdmin(user *auth.User) bool {
	return user.Role == roleAdmin
}

func normalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "administrator", "administrateur":
		return roleAdmin
	case "teacher", "prof", "professor", "enseignant":
		return roleTeacher
	case "student", "etudiant", "étudiant", "eleve", "élève":
		return roleStudent
	default:
		return ""
	}
}

func normalizeServerType(serverType string) string {
	switch strings.ToLower(strings.TrimSpace(serverType)) {
	case "teachers", "profs", "professeurs":
		return serverTypeTeachers
	case "community", "fraternity", "fraternite", "fraternité":
		return serverTypeCommunity
	case "class", "classe":
		return serverTypeClass
	default:
		return ""
	}
}

func mergeUserIDs(groups ...[]uint) []uint {
	seen := make(map[uint]bool)
	merged := make([]uint, 0)
	for _, group := range groups {
		for _, id := range group {
			if id == 0 || seen[id] {
				continue
			}
			seen[id] = true
			merged = append(merged, id)
		}
	}
	return merged
}

func uniqueSlug(tx *gorm.DB, base string, model any) string {
	if base == "" {
		base = fmt.Sprintf("espace-%d", time.Now().Unix())
	}
	slug := base
	for suffix := 2; ; suffix++ {
		var count int64
		tx.Model(model).Where("slug = ?", slug).Count(&count)
		if count == 0 {
			return slug
		}
		slug = fmt.Sprintf("%s-%d", base, suffix)
	}
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, r := range value {
		r = normalizeSlugRune(r)
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && builder.Len() > 0 {
			builder.WriteRune('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func normalizeSlugRune(r rune) rune {
	switch r {
	case 'à', 'á', 'â', 'ä', 'ã', 'å':
		return 'a'
	case 'ç':
		return 'c'
	case 'è', 'é', 'ê', 'ë':
		return 'e'
	case 'ì', 'í', 'î', 'ï':
		return 'i'
	case 'ñ':
		return 'n'
	case 'ò', 'ó', 'ô', 'ö', 'õ':
		return 'o'
	case 'ù', 'ú', 'û', 'ü':
		return 'u'
	case 'ý', 'ÿ':
		return 'y'
	default:
		return r
	}
}

func sanitizeFileName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "fichier"
	}
	replacer := strings.NewReplacer("/", "-", "\\", "-", ":", "-", "*", "-", "?", "", "\"", "", "<", "", ">", "", "|", "-")
	name = replacer.Replace(name)
	name = strings.Join(strings.Fields(name), "-")
	if name == "" {
		return "fichier"
	}
	return name
}

func formatBytes(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d o", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	units := []string{"Ko", "Mo", "Go", "To"}
	if exp >= len(units) {
		exp = len(units) - 1
	}
	return fmt.Sprintf("%.1f %s", float64(size)/float64(div), units[exp])
}

func seedData(dbConn *gorm.DB, uploadDir string) {
	admin := mustEnsureUser(dbConn, "Admin Centrale", "admin@test.local", roleAdmin, "admin")
	teacherMarie := mustEnsureUser(dbConn, "Prof. Marie", "prof@educonnect.local", roleTeacher, "Teacher123!")
	teacherRado := mustEnsureUser(dbConn, "Prof. Rado", "rado@educonnect.local", roleTeacher, "Teacher123!")
	studentThomas := mustEnsureUser(dbConn, "Thomas Dubois", "student@educonnect.local", roleStudent, "Student123!")
	studentNadia := mustEnsureUser(dbConn, "Nadia Kone", "nadia@educonnect.local", roleStudent, "Student123!")

	l1 := mustEnsureClass(dbConn, "L1 Informatique", "Introduction aux bases de la programmation et aux systèmes.")
	l2 := mustEnsureClass(dbConn, "L2 Réseaux", "Conception et maintenance des réseaux informatiques.")

	_ = ensureClassMember(dbConn, l1.ID, teacherMarie.ID, roleTeacher)
	_ = ensureClassMember(dbConn, l2.ID, teacherRado.ID, roleTeacher)
	_ = ensureClassMember(dbConn, l1.ID, studentThomas.ID, roleStudent)
	_ = ensureClassMember(dbConn, l2.ID, studentNadia.ID, roleStudent)

	teachersServer := mustEnsureServer(dbConn, "Serveur Profs", serverTypeTeachers, "Coordination pédagogique réservée aux professeurs.", admin.ID, nil)
	communityServer := mustEnsureServer(dbConn, "Fraternité", serverTypeCommunity, "Espace commun de l'établissement.", admin.ID, nil)
	l1Server := mustEnsureServer(dbConn, l1.Name, serverTypeClass, l1.Description, admin.ID, &l1.ID)
	l2Server := mustEnsureServer(dbConn, l2.Name, serverTypeClass, l2.Description, admin.ID, &l2.ID)

	for _, server := range []models.ChatServer{teachersServer, communityServer, l1Server, l2Server} {
		_ = ensureDefaultChannels(dbConn, server)
		_ = ensureServerMember(dbConn, server, admin)
	}

	_ = ensureServerMember(dbConn, teachersServer, teacherMarie)
	_ = ensureServerMember(dbConn, teachersServer, teacherRado)
	for _, member := range []models.User{teacherMarie, teacherRado, studentThomas, studentNadia} {
		_ = ensureServerMember(dbConn, communityServer, member)
	}
	_ = ensureServerMember(dbConn, l1Server, teacherMarie)
	_ = ensureServerMember(dbConn, l1Server, studentThomas)
	_ = ensureServerMember(dbConn, l2Server, teacherRado)
	_ = ensureServerMember(dbConn, l2Server, studentNadia)

	seedMessage(dbConn, l1Server, "Message global", teacherMarie, "Bienvenue dans le canal de la classe. Les échanges importants restent ici.")
	seedMessage(dbConn, l1Server, "Message global", studentThomas, "Bonjour professeur, les supports seront disponibles dans Fichiers ?")
	seedMessage(dbConn, l2Server, "Message global", teacherRado, "Le canal est ouvert pour les questions réseau et les consignes de séance.")
	seedMessage(dbConn, teachersServer, "Général", admin, "Le serveur profs est prêt pour la coordination pédagogique.")
	seedMessage(dbConn, communityServer, "Général", admin, "Bienvenue sur l'espace commun de l'intranet.")

	seedFile(dbConn, uploadDir, l1Server, "Fichiers", teacherMarie, "plan-pedagogique-l1.txt", "Plan pédagogique L1\nSupports et calendrier de la classe.\n")
	seedFile(dbConn, uploadDir, l2Server, "Fichiers", teacherRado, "guide-lab-reseaux.txt", "Guide lab réseaux\nPréparation des séances pratiques.\n")
}

func mustEnsureUser(dbConn *gorm.DB, name, email, role, password string) models.User {
	var user models.User
	email = strings.ToLower(email)
	if err := dbConn.Where("email = ?", email).First(&user).Error; err == nil {
		return user
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		panic(err)
	}
	user = models.User{Name: name, Email: email, Role: role, PasswordHash: hash}
	if err := dbConn.Create(&user).Error; err != nil {
		panic(err)
	}
	return user
}

func mustEnsureClass(dbConn *gorm.DB, name, description string) models.Class {
	var class models.Class
	slug := slugify(name)
	if err := dbConn.Where("slug = ?", slug).First(&class).Error; err == nil {
		return class
	}
	class = models.Class{Name: name, Slug: uniqueSlug(dbConn, slug, &models.Class{}), Description: description}
	if err := dbConn.Create(&class).Error; err != nil {
		panic(err)
	}
	return class
}

func mustEnsureServer(dbConn *gorm.DB, name, serverType, description string, ownerID uint, classID *uint) models.ChatServer {
	var server models.ChatServer
	query := dbConn.Where("type = ? AND slug = ?", serverType, slugify(name))
	if classID != nil {
		query = dbConn.Where("class_id = ?", *classID)
	}
	if err := query.First(&server).Error; err == nil {
		return server
	}
	server = models.ChatServer{
		Name:        name,
		Slug:        uniqueSlug(dbConn, slugify(name), &models.ChatServer{}),
		Type:        serverType,
		Description: description,
		OwnerID:     ownerID,
		ClassID:     classID,
	}
	if err := dbConn.Create(&server).Error; err != nil {
		panic(err)
	}
	return server
}

func seedMessage(dbConn *gorm.DB, server models.ChatServer, channelName string, author models.User, content string) {
	var channel models.Channel
	if err := dbConn.Where("server_id = ? AND name = ?", server.ID, channelName).First(&channel).Error; err != nil {
		return
	}
	var count int64
	dbConn.Model(&models.Message{}).Where("channel_id = ? AND content = ?", channel.ID, content).Count(&count)
	if count > 0 {
		return
	}
	_ = dbConn.Create(&models.Message{
		ChannelID: channel.ID,
		AuthorID:  author.ID,
		Author:    author.Name,
		Role:      author.Role,
		Content:   content,
	}).Error
}

func seedFile(dbConn *gorm.DB, uploadDir string, server models.ChatServer, channelName string, uploader models.User, fileName string, content string) {
	var channel models.Channel
	if err := dbConn.Where("server_id = ? AND name = ?", server.ID, channelName).First(&channel).Error; err != nil {
		return
	}
	var count int64
	dbConn.Model(&models.FileResource{}).Where("channel_id = ? AND name = ?", channel.ID, fileName).Count(&count)
	if count > 0 {
		return
	}
	storedName := "seed-" + sanitizeFileName(fileName)
	storagePath := filepath.Join(uploadDir, storedName)
	_ = os.WriteFile(storagePath, []byte(content), 0o644)
	info, err := os.Stat(storagePath)
	if err != nil {
		return
	}
	fileType := strings.TrimPrefix(strings.ToUpper(filepath.Ext(fileName)), ".")
	if fileType == "" {
		fileType = "TXT"
	}
	_ = dbConn.Create(&models.FileResource{
		ServerID:     server.ID,
		ChannelID:    channel.ID,
		ClassID:      channel.ClassID,
		Name:         fileName,
		Type:         fileType,
		Size:         formatBytes(info.Size()),
		SizeBytes:    info.Size(),
		MIMEType:     "text/plain; charset=utf-8",
		URL:          "/uploads/" + storedName,
		StoragePath:  storagePath,
		UploadedByID: uploader.ID,
		UploadedBy:   uploader.Name,
	}).Error
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Refresh-Token")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
