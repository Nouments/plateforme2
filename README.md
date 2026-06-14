# EduConnect

> A modern educational communication platform for universities, schools, and training centers — think Discord meets Microsoft Teams, built for institutions.

---

## What is EduConnect?

EduConnect is a centralized real-time communication and collaboration platform designed specifically for academic environments. Unlike Discord, server creation and management are controlled exclusively by administrators — students and professors cannot create spaces.

Every class (e.g. *L1 Informatics*, *L2 Networks*, *Master DevOps*) lives in its own **Class Space**, which contains channels, voice rooms, file storage, announcements, and meeting rooms.

---

## Features

- **Real-time messaging** — text channels with reactions, mentions, threads, attachments, and Markdown
- **File sharing** — upload, download, preview, and versioning (PDF, DOCX, PPTX, ZIP, images, video)
- **Voice channels** — join/leave, mute, screen sharing, push-to-talk (WebRTC)
- **Video meetings** — camera, microphone, screen sharing, recording, in-meeting chat (WebRTC)
- **Announcements** — rich text, images, attachments, scheduled publishing
- **Notifications** — real-time via WebSocket (messages, files, announcements, mentions, meetings)
- **Bulk user import** — CSV/XLSX upload with automatic account creation and credential delivery
- **Role-based access control** — Admin → Professor → Student hierarchy
- **Audit logging** — track logins, file events, user changes, and role updates
- **Administrative dashboard** — user counts, online status, storage usage, system health

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Go + Gin | REST API & routing |
| PostgreSQL | Primary database |
| Redis | Caching & sessions |
| WebSocket / NATS | Real-time messaging |
| GORM | ORM |
| MinIO (S3-compatible) | File storage |
| JWT | Authentication |
| Docker / Docker Compose | Containerization |

### Frontend
| Technology | Purpose |
|---|---|
| React + TypeScript | UI framework |
| Vite | Build tool |
| TailwindCSS + ShadCN UI | Styling & components |
| Redux Toolkit | Global state |
| React Query | Server state & caching |
| Socket.IO Client | Real-time events |
| React Router | Navigation |

---

## User Roles

### Administrator
Full platform control — create/delete classes, import users, manage permissions, reset passwords, view audit logs, create semesters and departments.

### Professor
Access assigned classes, send messages, share files, start meetings, create announcements, moderate students.

### Student
View assigned classes, send messages, upload files, participate in meetings, download resources.

---

## Class Structure

Each Class Space contains:

```
Class
├── General
├── Announcements
├── Assignments
├── Resources
├── Exams
├── Voice Channel
└── Meeting Room
```

---

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js 18+
- Docker & Docker Compose

### Backend

```bash
mkdir backend && cd backend
go mod init educonnect

go get github.com/gin-gonic/gin
go get gorm.io/gorm
go get gorm.io/driver/postgres
go get github.com/golang-jwt/jwt/v5
go get github.com/redis/go-redis/v9
go get github.com/nats-io/nats.go
go get github.com/gorilla/websocket
go get github.com/minio/minio-go/v7
go get github.com/google/uuid
go get golang.org/x/crypto/bcrypt
go get github.com/spf13/viper
go get github.com/go-playground/validator/v10
```

### Frontend

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

npm install react-router-dom @reduxjs/toolkit react-redux
npm install @tanstack/react-query socket.io-client axios
npm install tailwindcss @tailwindcss/vite
npm install lucide-react react-hook-form zod
npm install class-variance-authority clsx tailwind-merge
npm install sonner date-fns react-dropzone react-markdown

npx shadcn@latest init
```

### Infrastructure

```bash
docker compose up -d
```

Services: PostgreSQL, Redis, MinIO, NATS, Nginx.

---

## Project Structure

```
educonnect/
├── backend/
│   ├── cmd/
│   ├── internal/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── classes/
│   │   ├── chat/
│   │   ├── files/
│   │   ├── meetings/
│   │   ├── notifications/
│   │   └── audit/
│   ├── pkg/
│   ├── configs/
│   ├── migrations/
│   └── tests/
│
└── frontend/
    └── src/
        ├── features/
        │   ├── auth/
        │   ├── users/
        │   ├── classes/
        │   ├── chat/
        │   ├── files/
        │   └── meetings/
        ├── components/
        ├── hooks/
        ├── services/
        ├── store/
        ├── routes/
        ├── layouts/
        └── types/
```

---

## Bulk User Import

Administrators can import users via CSV or XLSX. The system automatically creates accounts, generates passwords, sends credentials, and assigns classes.

```csv
first_name,last_name,email,role,class
John,Doe,john@school.edu,student,L1-INF
Jane,Smith,jane@school.edu,student,L1-INF
Prof,Martin,martin@school.edu,professor,L1-INF
```

---

## Database Tables

`users` · `roles` · `classes` · `class_members` · `channels` · `messages` · `attachments` · `meetings` · `notifications` · `announcements` · `audit_logs` · `refresh_tokens` · `user_sessions`

---

## Roadmap

- [ ] Attendance tracking (auto from meetings)
- [ ] Assignment submission
- [ ] Grade management
- [ ] AI academic assistant
- [ ] Android & iOS apps
- [ ] Offline / PWA support

---

## Design Philosophy

EduConnect is built to feel like a combination of Discord, Microsoft Teams, Moodle, and Slack — but fully controlled by the institution. The UI prioritizes simplicity for non-technical users, mobile-first responsiveness, and a clean modern aesthetic without overwhelming complexity.
