package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type User struct {
	ID      string   `json:"id"`
	Email   string   `json:"email"`
	Role    string   `json:"role"`
	Classes []string `json:"classes"`
}

type AttendanceEvent struct {
	TeacherID string    `json:"teacherId"`
	Type      string    `json:"type"`
	At        time.Time `json:"at"`
}

type SharedFile struct {
	ID        string    `json:"id"`
	ClassID   string    `json:"classId"`
	TeacherID string    `json:"teacherId"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	At        time.Time `json:"at"`
}

type Announcement struct {
	ID      string    `json:"id"`
	Message string    `json:"message"`
	At      time.Time `json:"at"`
}

type Hub struct {
	mu      sync.Mutex
	clients map[chan []byte]bool
}

func (h *Hub) broadcast(v any) {
	b, _ := json.Marshal(v)
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		select {
		case c <- b:
		default:
		}
	}
}

type Store struct {
	mu            sync.Mutex
	attendance    []AttendanceEvent
	filesByClass  map[string][]SharedFile
	announcements []Announcement
	timetable     map[string]int
}

func main() {
	store := &Store{filesByClass: map[string][]SharedFile{"L3": {}, "M1": {}}, timetable: map[string]int{"teacher-1": 6}}
	hub := &Hub{clients: map[chan []byte]bool{}}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, map[string]string{"status": "ok"}) })
	mux.HandleFunc("/api/auth/login", handleLogin)
	mux.HandleFunc("/api/attendance/check", withStoreHub(store, hub, handleAttendanceCheck))
	mux.HandleFunc("/api/admin/attendance/report", withStoreHub(store, hub, handleAdminAttendanceReport))
	mux.HandleFunc("/api/classes/", withStoreHub(store, hub, handleClassFiles))
	mux.HandleFunc("/api/admin/announcements", withStoreHub(store, hub, handleAdminAnnouncements))
	mux.HandleFunc("/api/announcements", withStoreHub(store, hub, handleAnnouncements))
	mux.HandleFunc("/events", handleEvents(hub))

	log.Println("backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", cors(mux)))
}

func withStoreHub(store *Store, hub *Hub, h func(http.ResponseWriter, *http.Request, *Store, *Hub)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { h(w, r, store, hub) }
}

func handleEvents(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "stream unsupported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		ch := make(chan []byte, 8)
		hub.mu.Lock()
		hub.clients[ch] = true
		hub.mu.Unlock()
		defer func() {
			hub.mu.Lock()
			delete(hub.clients, ch)
			hub.mu.Unlock()
			close(ch)
		}()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-ch:
				_, _ = fmt.Fprintf(w, "data: %s\n\n", string(msg))
				flusher.Flush()
			}
		}
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) { /* unchanged simplified */
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	email := strings.ToLower(req.Email)
	user := User{ID: "student-1", Email: email, Role: "student", Classes: []string{"L3"}}
	switch {
	case strings.Contains(email, "admin"):
		user = User{ID: "admin-1", Email: email, Role: "admin"}
	case strings.Contains(email, "prof") || strings.Contains(email, "teacher"):
		user = User{ID: "teacher-1", Email: email, Role: "teacher", Classes: []string{"L3"}}
	}
	writeJSON(w, user)
}

func handleAttendanceCheck(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct{ TeacherID, Type string }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Type != "start" && req.Type != "end") {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	ev := AttendanceEvent{TeacherID: req.TeacherID, Type: req.Type, At: time.Now()}
	store.mu.Lock()
	store.attendance = append(store.attendance, ev)
	store.mu.Unlock()
	hub.broadcast(map[string]any{"type": "attendance", "payload": ev})
	writeJSON(w, ev)
}

func handleAdminAttendanceReport(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	starts, ends := 0, 0
	for _, e := range store.attendance {
		if e.TeacherID == "teacher-1" {
			if e.Type == "start" {
				starts++
			} else if e.Type == "end" {
				ends++
			}
		}
	}
	worked := (starts + ends) / 2 * 2
	expected := store.timetable["teacher-1"]
	missing := expected - worked
	if missing < 0 {
		missing = 0
	}
	writeJSON(w, map[string]any{"teacherId": "teacher-1", "expectedHours": expected, "workedHours": worked, "missingHours": missing, "eventsRecorded": len(store.attendance)})
}

func handleClassFiles(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/classes/"), "/")
	if len(parts) != 2 || parts[1] != "files" {
		http.NotFound(w, r)
		return
	}
	classID := parts[0]
	if r.Method == http.MethodGet {
		store.mu.Lock()
		files := append([]SharedFile(nil), store.filesByClass[classID]...)
		store.mu.Unlock()
		sort.Slice(files, func(i, j int) bool { return files[i].At.After(files[j].At) })
		writeJSON(w, files)
		return
	}
	if r.Method == http.MethodPost {
		var req struct{ TeacherID, Name, URL string }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		file := SharedFile{ID: time.Now().Format("20060102150405"), ClassID: classID, TeacherID: req.TeacherID, Name: req.Name, URL: req.URL, At: time.Now()}
		store.mu.Lock()
		store.filesByClass[classID] = append(store.filesByClass[classID], file)
		store.mu.Unlock()
		hub.broadcast(map[string]any{"type": "file_uploaded", "payload": file})
		writeJSON(w, file)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func handleAdminAnnouncements(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	a := Announcement{ID: time.Now().Format("20060102150405"), Message: req.Message, At: time.Now()}
	store.mu.Lock()
	store.announcements = append([]Announcement{a}, store.announcements...)
	store.mu.Unlock()
	hub.broadcast(map[string]any{"type": "announcement", "payload": a})
	writeJSON(w, a)
}

func handleAnnouncements(w http.ResponseWriter, r *http.Request, store *Store, hub *Hub) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	store.mu.Lock()
	ann := append([]Announcement(nil), store.announcements...)
	store.mu.Unlock()
	writeJSON(w, ann)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
