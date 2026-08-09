package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"strconv"
	"time"

	"educonnect/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Claims struct {
	UserID uint   `json:"user_id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	db           *gorm.DB
	secret       string
	refreshSecret string
	accessTTL    time.Duration
	refreshTTL   time.Duration
}

func NewService(db *gorm.DB, secret, refreshSecret string) *Service {
	accessTTL := 15 * time.Minute
	refreshTTL := 7 * 24 * time.Hour
	if len(secret) == 0 {
		secret = "educonnect-secret-key"
	}
	if len(refreshSecret) == 0 {
		refreshSecret = "educonnect-refresh-key"
	}
	return &Service{db: db, secret: secret, refreshSecret: refreshSecret, accessTTL: accessTTL, refreshTTL: refreshTTL}
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func VerifyPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func (s *Service) Authenticate(email, password string) (*models.User, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, errors.New("identifiants incorrects")
	}
	if err := VerifyPassword(user.PasswordHash, password); err != nil {
		return nil, errors.New("identifiants incorrects")
	}
	return &user, nil
}

func (s *Service) GenerateTokens(user *models.User) (string, string, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return "", "", err
	}
	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return "", "", err
	}
	return accessToken, refreshToken, nil
}

func (s *Service) generateAccessToken(user *models.User) (string, error) {
	claims := Claims{
		UserID: user.ID,
		Name:   user.Name,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.secret))
}

func (s *Service) generateRefreshToken(user *models.User) (string, error) {
	claims := Claims{
		UserID: user.ID,
		Name:   user.Name,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.refreshSecret))
}

func (s *Service) ParseAccessToken(tokenString string) (*User, error) {
	parsed, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("jeton invalide")
	}

	return &User{ID: claims.UserID, Name: claims.Name, Email: claims.Email, Role: claims.Role}, nil
}

func (s *Service) ParseRefreshToken(tokenString string) (*User, error) {
	parsed, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.refreshSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("jeton de rafraîchissement invalide")
	}
	return &User{ID: claims.UserID, Name: claims.Name, Email: claims.Email, Role: claims.Role}, nil
}

func (s *Service) StoreRefreshToken(userID uint, rawToken string, expiresAt time.Time) error {
	hash := s.hashToken(rawToken)
	return s.db.Create(&models.RefreshToken{TokenHash: hash, UserID: userID, ExpiresAt: expiresAt, Revoked: false}).Error
}

func (s *Service) ValidateRefreshToken(rawToken string) (*models.RefreshToken, error) {
	hash := s.hashToken(rawToken)
	var token models.RefreshToken
	if err := s.db.Preload("User").Where("token_hash = ?", hash).First(&token).Error; err != nil {
		return nil, errors.New("rafraîchissement invalide")
	}
	if token.Revoked || token.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("jeton de rafraîchissement expiré ou révoqué")
	}
	return &token, nil
}

func (s *Service) RevokeRefreshToken(rawToken string) error {
	hash := s.hashToken(rawToken)
	return s.db.Model(&models.RefreshToken{}).Where("token_hash = ?", hash).Update("revoked", true).Error
}

func (s *Service) GetUserByID(id uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func GetJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "educonnect-secret-key"
	}
	return secret
}

func GetRefreshSecret() string {
	secret := os.Getenv("REFRESH_SECRET")
	if secret == "" {
		secret = "educonnect-refresh-key"
	}
	return secret
}
