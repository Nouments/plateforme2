import React, { useState } from 'react'
import {
  ArrowLeft,
  Save,
  Lock,
  User,
  Image,
  LogOut,
} from 'lucide-react'
import { api } from '../services/api'
import './SettingsPage.css'

export function SettingsPage({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState('profile') // 'profile' or 'password'
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    photo: user?.photo || '',
  })
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user?.photo || '')

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfileData({ ...profileData, [name]: value })
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        setPhotoPreview(base64)
        setProfileData({ ...profileData, photo: base64 })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await api.updateUser?.(user?.id, {
        email: profileData.email,
        photo: profileData.photo,
      })
      setSuccess('Profil mis à jour avec succès')
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour du profil')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    setError('')
    setSuccess('')

    if (!passwordData.current) {
      setError('Veuillez entrer votre mot de passe actuel')
      return
    }
    if (!passwordData.new) {
      setError('Veuillez entrer un nouveau mot de passe')
      return
    }
    if (passwordData.new !== passwordData.confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (passwordData.new.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    try {
      await api.updateUser?.(user?.id, {
        currentPassword: passwordData.current,
        password: passwordData.new,
      })
      setSuccess('Mot de passe changé avec succès')
      setPasswordData({ current: '', new: '', confirm: '' })
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setLoading(false)
    }
  }

  const initials = (name = '') => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="settings-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Retour
        </button>
        <h1>Paramètres</h1>
        <button className="settings-logout-btn" onClick={onLogout}>
          <LogOut size={20} />
        </button>
      </header>

      <div className="settings-container">
        <nav className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} />
            Profil
          </button>
          <button
            className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <Lock size={18} />
            Sécurité
          </button>
        </nav>

        <div className="settings-content">
          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}

          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>Profil utilisateur</h2>

              <div className="profile-avatar-section">
                <div className="profile-avatar-display">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profil" />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      {initials(user?.name)}
                    </div>
                  )}
                </div>
                <div className="profile-avatar-actions">
                  <p className="profile-avatar-name">{user?.name}</p>
                  <p className="profile-avatar-role">{user?.role}</p>
                  <label className="profile-upload-btn">
                    <Image size={16} />
                    Changer de photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              <div className="settings-form">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    placeholder="email@domain.com"
                  />
                </div>

                <button
                  className="btn-primary"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  <Save size={16} />
                  {loading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>

              <div className="settings-info">
                <p>
                  <strong>Note :</strong> Vous ne pouvez pas modifier votre nom d'utilisateur
                </p>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="settings-section">
              <h2>Changer le mot de passe</h2>

              <div className="settings-form">
                <div className="form-group">
                  <label>Mot de passe actuel</label>
                  <input
                    type="password"
                    value={passwordData.current}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, current: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={passwordData.new}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, new: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={passwordData.confirm}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirm: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <button
                  className="btn-primary"
                  onClick={handleChangePassword}
                  disabled={loading}
                >
                  <Lock size={16} />
                  {loading ? 'Changement...' : 'Changer le mot de passe'}
                </button>
              </div>

              <div className="settings-info">
                <p>
                  <strong>Conseils de sécurité :</strong>
                </p>
                <ul>
                  <li>Utilisez un mot de passe fort avec des majuscules, minuscules et chiffres</li>
                  <li>Ne réutilisez pas vos anciens mots de passe</li>
                  <li>Changez votre mot de passe régulièrement</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
