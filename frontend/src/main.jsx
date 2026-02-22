import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = 'http://localhost:8080'

function App() {
  const [email, setEmail] = useState('admin@seminaire.local')
  const [user, setUser] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [files, setFiles] = useState([])
  const [report, setReport] = useState(null)
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [fileName, setFileName] = useState('Support du cours - Réseau')

  useEffect(() => {
    const es = new EventSource('http://localhost:8080/events')
    es.onmessage = (evt) => {
      const data = JSON.parse(evt.data)
      setNotifications((prev) => [data, ...prev].slice(0, 12))
      if (data.type === 'announcement') fetchAnnouncements()
      if (data.type === 'file_uploaded') fetchFiles('L3')
    }
    return () => es.close()
  }, [])

  const roleLabel = useMemo(() => {
    if (!user) return 'Non connecté'
    if (user.role === 'admin') return 'Administrateur'
    if (user.role === 'teacher') return 'Enseignant'
    return 'Étudiant'
  }, [user])

  async function login() {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setUser(data)
    fetchAnnouncements()
    fetchFiles((data.classes && data.classes[0]) || 'L3')
    if (data.role === 'admin') fetchReport()
  }

  async function fetchAnnouncements() {
    const res = await fetch(`${API}/api/announcements`)
    setAnnouncements(await res.json())
  }

  async function fetchFiles(classId = 'L3') {
    const res = await fetch(`${API}/api/classes/${classId}/files`)
    setFiles(await res.json())
  }

  async function check(type) {
    await fetch(`${API}/api/attendance/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: 'teacher-1', type }),
    })
  }

  async function postAnnouncement() {
    await fetch(`${API}/api/admin/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: announcementMessage }),
    })
    setAnnouncementMessage('')
    fetchAnnouncements()
  }

  async function uploadFile() {
    await fetch(`${API}/api/classes/L3/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: 'teacher-1', name: fileName, url: '#' }),
    })
    setFileName('')
    fetchFiles('L3')
  }

  async function fetchReport() {
    const res = await fetch(`${API}/api/admin/attendance/report`)
    setReport(await res.json())
  }

  return (
    <div className="page">
      <h1>Plateforme Séminaire (Intranet)</h1>
      <div className="card">
        <h2>Connexion</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={login}>Se connecter</button>
        <p>Rôle: {roleLabel}</p>
      </div>

      {user && user.role === 'teacher' && (
        <div className="card">
          <h2>Espace enseignant</h2>
          <button onClick={() => check('start')}>Pointage début de cours</button>
          <button onClick={() => check('end')}>Pointage fin de cours</button>
          <div className="row">
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Nom du document" />
            <button onClick={uploadFile}>Publier fichier pour L3</button>
          </div>
        </div>
      )}

      {user && user.role === 'admin' && (
        <div className="card">
          <h2>Espace admin</h2>
          <div className="row">
            <input value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Annonce broadcast" />
            <button onClick={postAnnouncement}>Publier annonce</button>
            <button onClick={fetchReport}>Rafraîchir rapport présence</button>
          </div>
          {report && (
            <pre>{JSON.stringify(report, null, 2)}</pre>
          )}
        </div>
      )}

      {user && (
        <div className="grid">
          <div className="card">
            <h3>Annonces</h3>
            {announcements.map((a) => (
              <p key={a.id}>• {a.message}</p>
            ))}
          </div>
          <div className="card">
            <h3>Fichiers classe L3</h3>
            {files.map((f) => (
              <p key={f.id}>📄 {f.name}</p>
            ))}
          </div>
          <div className="card">
            <h3>Temps réel (SSE)</h3>
            {notifications.map((n, i) => (
              <p key={i}>[{n.type}] notification reçue</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
