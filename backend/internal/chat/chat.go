package chat

import (
	"sync"
	"time"

	"educonnect/internal/auth"
	"github.com/gorilla/websocket"
)

type Message struct {
	ID     string `json:"id"`
	Room   string `json:"room"`
	Author string `json:"author"`
	Role   string `json:"role"`
	Text   string `json:"text"`
	Time   string `json:"time"`
}

type Room struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Client struct {
	conn *websocket.Conn
	send chan Message
	user auth.User
}

type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan Message
	lock       sync.RWMutex
}

var rooms = []Room{
	{ID: "general", Name: "General", Description: "Text chat for the class."},
	{ID: "announcements", Name: "Announcements", Description: "Important updates and documents."},
	{ID: "resources", Name: "Resources", Description: "Shared files and course material."},
}

var messages []Message
var messagesLock sync.RWMutex

func init() {
	messages = []Message{
		{ID: "m1", Room: "general", Author: "Prof. Marie", Role: "professor", Text: "Bienvenue sur EduConnect. Connectez-vous, choisissez une salle et discutez en temps réel.", Time: time.Now().Format("15:04")},
		{ID: "m2", Room: "general", Author: "Eleve Thomas", Role: "student", Text: "Je teste le chat WebSocket !", Time: time.Now().Add(time.Minute * 2).Format("15:04")},
	}
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message, 32),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.lock.Lock()
			h.clients[client] = true
			h.lock.Unlock()
		case client := <-h.unregister:
			h.lock.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.lock.Unlock()
		case message := <-h.broadcast:
			h.lock.Lock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.lock.Unlock()
		}
	}
}

func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

func (h *Hub) BroadcastMessage(message Message) {
	h.broadcast <- message
}

func NewClient(conn *websocket.Conn, user auth.User) *Client {
	return &Client{conn: conn, send: make(chan Message, 16), user: user}
}

func (c *Client) ReadPump(h *Hub) {
	defer func() {
		h.unregister <- c
		c.conn.Close()
	}()

	for {
		var request struct {
			Room string `json:"room"`
			Text string `json:"text"`
		}
		if err := c.conn.ReadJSON(&request); err != nil {
			break
		}
		// Messages are persisted through the REST API before being broadcast.
	}
}

func (c *Client) WritePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteJSON(msg); err != nil {
			break
		}
	}
}

func NewMessage(user *auth.User, room, text string) Message {
	return Message{
		ID:     time.Now().Format("20060102150405"),
		Room:   room,
		Author: user.Name,
		Role:   user.Role,
		Text:   text,
		Time:   time.Now().Format("15:04"),
	}
}

func GetRooms() []Room {
	return rooms
}

func GetMessages(room string) []Message {
	messagesLock.RLock()
	defer messagesLock.RUnlock()
	if room == "" {
		return append([]Message(nil), messages...)
	}
	filtered := make([]Message, 0, len(messages))
	for _, msg := range messages {
		if msg.Room == room {
			filtered = append(filtered, msg)
		}
	}
	return filtered
}

func AddMessage(message Message) {
	messagesLock.Lock()
	defer messagesLock.Unlock()
	messages = append(messages, message)
	if len(messages) > 120 {
		messages = messages[len(messages)-120:]
	}
}
