package models

import "time"

type User struct {
	ID                uint           `gorm:"primarykey" json:"id"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         *time.Time     `gorm:"index" json:"-"`
	Name              string         `gorm:"size:255;not null" json:"name"`
	Email             string         `gorm:"size:255;not null;uniqueIndex" json:"email"`
	Role              string         `gorm:"size:60;not null" json:"role"`
	PasswordHash      string         `gorm:"size:255;not null" json:"-"`
	RefreshTokens     []RefreshToken `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	ServerMemberships []ServerMember `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	ClassMemberships  []ClassMember  `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
}

type RefreshToken struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt *time.Time `gorm:"index" json:"-"`
	TokenHash string     `gorm:"size:255;not null;uniqueIndex" json:"-"`
	UserID    uint       `gorm:"index;not null" json:"userId"`
	User      User       `gorm:"foreignKey:UserID" json:"-"`
	ExpiresAt time.Time  `json:"expiresAt"`
	Revoked   bool       `gorm:"not null;default:false" json:"revoked"`
}

type Class struct {
	ID          uint          `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
	DeletedAt   *time.Time    `gorm:"index" json:"-"`
	Name        string        `gorm:"size:255;not null" json:"name"`
	Slug        string        `gorm:"size:255;not null;uniqueIndex" json:"slug"`
	Description string        `gorm:"type:text;not null" json:"description"`
	Channels    []Channel     `gorm:"constraint:OnDelete:CASCADE;" json:"channels"`
	Members     []ClassMember `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Server      *ChatServer   `gorm:"constraint:OnDelete:SET NULL;" json:"-"`
}

type ChatServer struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   *time.Time     `gorm:"index" json:"-"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Slug        string         `gorm:"size:255;not null;uniqueIndex" json:"slug"`
	Type        string         `gorm:"size:80;not null;index" json:"type"`
	Description string         `gorm:"type:text;not null" json:"description"`
	OwnerID     uint           `gorm:"index;not null" json:"ownerId"`
	Owner       User           `gorm:"foreignKey:OwnerID" json:"owner"`
	ClassID     *uint          `gorm:"uniqueIndex" json:"classId"`
	Class       *Class         `gorm:"foreignKey:ClassID" json:"class"`
	Channels    []Channel      `gorm:"foreignKey:ServerID;constraint:OnDelete:CASCADE" json:"channels"`
	Members     []ServerMember `gorm:"foreignKey:ServerID;constraint:OnDelete:CASCADE" json:"members"`
}

type ServerMember struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt *time.Time `gorm:"index" json:"-"`
	ServerID  uint       `gorm:"uniqueIndex:idx_server_user;index;not null" json:"serverId"`
	Server    ChatServer `gorm:"foreignKey:ServerID" json:"-"`
	UserID    uint       `gorm:"uniqueIndex:idx_server_user;index;not null" json:"userId"`
	User      User       `gorm:"foreignKey:UserID" json:"user"`
	Role      string     `gorm:"size:80;not null" json:"role"`
}

type ClassMember struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt *time.Time `gorm:"index" json:"-"`
	ClassID   uint       `gorm:"uniqueIndex:idx_class_user;index;not null" json:"classId"`
	Class     Class      `gorm:"foreignKey:ClassID" json:"-"`
	UserID    uint       `gorm:"uniqueIndex:idx_class_user;index;not null" json:"userId"`
	User      User       `gorm:"foreignKey:UserID" json:"user"`
	Role      string     `gorm:"size:80;not null" json:"role"`
}

type Channel struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   *time.Time     `gorm:"index" json:"-"`
	ServerID    uint           `gorm:"index;not null" json:"serverId"`
	Server      ChatServer     `gorm:"foreignKey:ServerID;constraint:OnDelete:CASCADE" json:"-"`
	ClassID     *uint          `gorm:"index" json:"classId"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Type        string         `gorm:"size:80;not null" json:"type"`
	Description string         `gorm:"type:text;not null" json:"description"`
	Messages    []Message      `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Files       []FileResource `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
}

type Message struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt *time.Time `gorm:"index" json:"-"`
	ChannelID uint       `gorm:"index;not null" json:"channelId"`
	Channel   Channel    `gorm:"foreignKey:ChannelID" json:"-"`
	AuthorID  uint       `gorm:"index;not null" json:"authorId"`
	Author    string     `gorm:"size:255;not null" json:"author"`
	Role      string     `gorm:"size:80;not null" json:"role"`
	Content   string     `gorm:"type:text;not null" json:"content"`
}

type Announcement struct {
	ID        uint       `gorm:"primarykey" json:"id"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	DeletedAt *time.Time `gorm:"index" json:"-"`
	ClassID   uint       `gorm:"index;not null" json:"classId"`
	Title     string     `gorm:"size:255;not null" json:"title"`
	Body      string     `gorm:"type:text;not null" json:"body"`
	Author    string     `gorm:"size:255;not null" json:"author"`
}

type FileResource struct {
	ID           uint       `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	DeletedAt    *time.Time `gorm:"index" json:"-"`
	ServerID     uint       `gorm:"index;not null" json:"serverId"`
	ChannelID    uint       `gorm:"index;not null" json:"channelId"`
	ClassID      *uint      `gorm:"index" json:"classId"`
	Name         string     `gorm:"size:255;not null" json:"name"`
	Type         string     `gorm:"size:80;not null" json:"type"`
	Size         string     `gorm:"size:80;not null" json:"size"`
	SizeBytes    int64      `gorm:"not null;default:0" json:"sizeBytes"`
	MIMEType     string     `gorm:"size:255;not null" json:"mimeType"`
	URL          string     `gorm:"size:600;not null" json:"url"`
	StoragePath  string     `gorm:"size:600;not null" json:"-"`
	UploadedByID uint       `gorm:"index;not null" json:"uploadedById"`
	UploadedBy   string     `gorm:"size:255;not null" json:"uploadedBy"`
}

type Meeting struct {
	ID           uint       `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	DeletedAt    *time.Time `gorm:"index" json:"-"`
	ClassID      uint       `gorm:"index;not null" json:"classId"`
	Title        string     `gorm:"size:255;not null" json:"title"`
	Description  string     `gorm:"type:text;not null" json:"description"`
	Status       string     `gorm:"size:80;not null" json:"status"`
	StartsAt     time.Time  `json:"startsAt"`
	Room         string     `gorm:"size:255;not null" json:"room"`
	Participants string     `gorm:"type:text;not null" json:"participants"`
}
