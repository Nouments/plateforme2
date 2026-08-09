import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import TeacherPage from './pages/TeacherPage'
import StudentPage from './pages/StudentPage'
import NotFoundPage from './pages/NotFoundPage'
import { getStoredSession, logout } from './services/api'
import { setupTokenExpirationCheck } from './utils/tokenManager'
import './App.css'

function App() {
  useEffect(() => {
    // Setup auto-logout on token expiration
    const session = getStoredSession()
    if (session?.accessToken) {
      const cleanup = setupTokenExpirationCheck(session.accessToken, () => {
        logout().then(() => {
          window.location.href = '/login'
        }).catch(() => {
          window.location.href = '/login'
        })
      })

      return () => {
        if (cleanup?.cleanup) {
          cleanup.cleanup()
        }
      }
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/student" element={<StudentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
