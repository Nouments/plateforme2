package presence

import (
	"sync"
	"time"

	"educonnect/internal/auth"
	"github.com/gorilla/websocket"
)

type PresenceEvent struct {
	Type      string `json:"type"` // "online", "offline", "typing"
	UserID    uint   `json:"userId"`
	UserName  string `json:"userName"`
	Timestamp string `json:"timestamp"`
}

type PresenceClient struct {
	conn   *websocket.Conn
	send   chan PresenceEvent
	user   auth.User
	closer chan struct{}
}

type PresenceHub struct {
	clients    map[*PresenceClient]bool
	register   chan *PresenceClient
	unregister chan *PresenceClient
	broadcast  chan PresenceEvent
	lock       sync.RWMutex
	userStatus map[uint]bool // userID -> isOnline
}

func NewPresenceHub() *PresenceHub {
	return &PresenceHub{
		clients:    make(map[*PresenceClient]bool),
		register:   make(chan *PresenceClient),
		unregister: make(chan *PresenceClient),
		broadcast:  make(chan PresenceEvent, 32),
		userStatus: make(map[uint]bool),
	}
}

func (h *PresenceHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.lock.Lock()
			h.clients[client] = true
			h.userStatus[client.user.ID] = true
			h.lock.Unlock()

			// Broadcast online event
			event := PresenceEvent{
				Type:      "online",
				UserID:    client.user.ID,
				UserName:  client.user.Name,
				Timestamp: time.Now().Format("2006-01-02T15:04:05Z07:00"),
			}
			h.BroadcastEvent(event)

		case client := <-h.unregister:
			h.lock.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				h.userStatus[client.user.ID] = false
				h.lock.Unlock()

				// Broadcast offline event
				event := PresenceEvent{
					Type:      "offline",
					UserID:    client.user.ID,
					UserName:  client.user.Name,
					Timestamp: time.Now().Format("2006-01-02T15:04:05Z07:00"),
				}
				h.BroadcastEvent(event)
			} else {
				h.lock.Unlock()
			}
			close(client.send)

		case event := <-h.broadcast:
			h.lock.RLock()
			for client := range h.clients {
				select {
				case client.send <- event:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.lock.RUnlock()
		}
	}
}

func (h *PresenceHub) RegisterClient(client *PresenceClient) {
	h.register <- client
}

func (h *PresenceHub) UnregisterClient(client *PresenceClient) {
	select {
	case h.unregister <- client:
	case <-time.After(time.Second):
	}
}

func (h *PresenceHub) BroadcastEvent(event PresenceEvent) {
	h.broadcast <- event
}

func (h *PresenceHub) GetUserStatus(userID uint) bool {
	h.lock.RLock()
	defer h.lock.RUnlock()
	return h.userStatus[userID]
}

func (h *PresenceHub) GetAllStatus() map[uint]bool {
	h.lock.RLock()
	defer h.lock.RUnlock()
	result := make(map[uint]bool)
	for uid, status := range h.userStatus {
		result[uid] = status
	}
	return result
}

func NewPresenceClient(conn *websocket.Conn, user auth.User) *PresenceClient {
	return &PresenceClient{
		conn:   conn,
		send:   make(chan PresenceEvent, 16),
		user:   user,
		closer: make(chan struct{}),
	}
}

func (c *PresenceClient) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case event, ok := <-c.send:
			if !ok {
				return
			}
			if err := c.conn.WriteJSON(event); err != nil {
				return
			}
		case <-ticker.C:
			// Send heartbeat
			if err := c.conn.WriteJSON(map[string]interface{}{
				"type": "heartbeat",
				"time": time.Now().Format("2006-01-02T15:04:05Z07:00"),
			}); err != nil {
				return
			}
		case <-c.closer:
			return
		}
	}
}

func (c *PresenceClient) Close() {
	close(c.closer)
	c.conn.Close()
}
