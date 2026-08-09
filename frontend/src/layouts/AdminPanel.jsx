import React, { useState } from 'react'
import {
  ArrowLeft,
  Users,
  Server,
  LogOut,
  Edit2,
  Trash2,
  Plus,
  Eye,
  Lock,
  Image,
  MoreVertical,
} from 'lucide-react'
import { api } from '../services/api'
import './AdminPanel.css'

export function AdminPanel({ user, servers, users, onBack, onLogout, onDataRefresh }) {
  const [activeTab, setActiveTab] = useState('users') // 'users', 'servers', 'announcements'
  const [editingUser, setEditingUser] = useState(null)
  const [editingServer, setEditingServer] = useState(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [showServerForm, setShowServerForm] = useState(false)
  const [formData, setFormData] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleAddUser = () => {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      role: 'student',
      password: '',
    })
    setShowUserForm(true)
  }

  const handleEditUser = (userData) => {
    setEditingUser(userData)
    setFormData({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      password: '',
    })
    setShowUserForm(true)
  }

  const handleSaveUser = async () => {
    setError('')
    setSuccess('')
    try {
      if (editingUser) {
        // Update existing user
        await api.updateUser?.(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          ...(formData.password && { password: formData.password }),
        })
        setSuccess('Utilisateur mis à jour')
      } else {
        // Create new user
        await api.createUser?.(formData)
        setSuccess('Utilisateur créé')
      }
      setShowUserForm(false)
      onDataRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) {
      setError('')
      try {
        await api.deleteUser?.(userId)
        setSuccess('Utilisateur supprimé')
        onDataRefresh()
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const handleAddServer = () => {
    setEditingServer(null)
    setFormData({
      name: '',
      type: 'class',
      description: '',
    })
    setShowServerForm(true)
  }

  const handleEditServer = (serverData) => {
    setEditingServer(serverData)
    setFormData({
      name: serverData.name,
      type: serverData.type,
      description: serverData.description,
    })
    setShowServerForm(true)
  }

  const handleSaveServer = async () => {
    setError('')
    setSuccess('')
    try {
      if (editingServer) {
        await api.updateServer?.(editingServer.id, formData)
        setSuccess('Serveur mis à jour')
      } else {
        await api.createServer?.(formData)
        setSuccess('Serveur créé')
      }
      setShowServerForm(false)
      onDataRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteServer = async (serverId) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce serveur?')) {
      setError('')
      try {
        await api.deleteServer?.(serverId)
        setSuccess('Serveur supprimé')
        onDataRefresh()
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const handleChangeUserPassword = async (userId) => {
    const newPassword = prompt('Nouveau mot de passe:')
    if (!newPassword) return
    
    setError('')
    try {
      await api.updateUser?.(userId, { password: newPassword })
      setSuccess('Mot de passe mis à jour')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>Panneau d'Administration</h1>
        <button className="admin-logout-btn" onClick={onLogout}>
          <LogOut size={20} />
        </button>
      </header>

      <nav className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} />
          Utilisateurs
        </button>
        <button
          className={`admin-tab ${activeTab === 'servers' ? 'active' : ''}`}
          onClick={() => setActiveTab('servers')}
        >
          <Server size={18} />
          Serveurs
        </button>
      </nav>

      <div className="admin-content">
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Gestion des Utilisateurs</h2>
              <button
                className="admin-add-btn"
                onClick={handleAddUser}
              >
                <Plus size={18} />
                Ajouter
              </button>
            </div>

            {showUserForm && (
              <div className="admin-form-card">
                <h3>{editingUser ? 'Modifier' : 'Créer'} un utilisateur</h3>
                <div className="admin-form">
                  <div className="form-group">
                    <label>Nom</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nom complet"
                      disabled={!!editingUser}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@domain.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Rôle</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="student">Étudiant</option>
                      <option value="teacher">Professeur</option>
                      <option value="administrator">Administrateur</option>
                    </select>
                  </div>
                  {!editingUser && (
                    <div className="form-group">
                      <label>Mot de passe initial</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  )}
                  <div className="form-actions">
                    <button className="btn-primary" onClick={handleSaveUser}>
                      {editingUser ? 'Mettre à jour' : 'Créer'}
                    </button>
                    <button className="btn-secondary" onClick={() => setShowUserForm(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="admin-list">
              {users && users.length > 0 ? (
                users.map((userData) => (
                  <div key={userData.id} className="admin-item">
                    <div className="admin-item-info">
                      <div className="admin-item-avatar">
                        {userData.name
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="admin-item-name">{userData.name}</p>
                        <p className="admin-item-detail">{userData.email}</p>
                        <p className="admin-item-role">{userData.role}</p>
                      </div>
                    </div>
                    <div className="admin-item-actions">
                      <button
                        className="admin-action-btn"
                        onClick={() => handleChangeUserPassword(userData.id)}
                        title="Changer le mot de passe"
                      >
                        <Lock size={18} />
                      </button>
                      <button
                        className="admin-action-btn"
                        onClick={() => handleEditUser(userData)}
                        title="Modifier"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="admin-action-btn admin-action-delete"
                        onClick={() => handleDeleteUser(userData.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="admin-empty">Aucun utilisateur</p>
              )}
            </div>
          </div>
        )}

        {/* Servers Tab */}
        {activeTab === 'servers' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Gestion des Serveurs</h2>
              <button
                className="admin-add-btn"
                onClick={handleAddServer}
              >
                <Plus size={18} />
                Ajouter
              </button>
            </div>

            {showServerForm && (
              <div className="admin-form-card">
                <h3>{editingServer ? 'Modifier' : 'Créer'} un serveur</h3>
                <div className="admin-form">
                  <div className="form-group">
                    <label>Nom</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nom du serveur"
                    />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="class">Classe</option>
                      <option value="teachers">Serveur profs</option>
                      <option value="community">Fraternité</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description du serveur"
                      rows="3"
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-primary" onClick={handleSaveServer}>
                      {editingServer ? 'Mettre à jour' : 'Créer'}
                    </button>
                    <button className="btn-secondary" onClick={() => setShowServerForm(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="admin-list">
              {servers && servers.length > 0 ? (
                servers.map((serverData) => (
                  <div key={serverData.id} className="admin-item">
                    <div className="admin-item-info">
                      <div className="admin-item-avatar">
                        {serverData.name
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="admin-item-name">{serverData.name}</p>
                        <p className="admin-item-detail">{serverData.description}</p>
                        <p className="admin-item-role">{serverData.type}</p>
                      </div>
                    </div>
                    <div className="admin-item-actions">
                      <button
                        className="admin-action-btn"
                        onClick={() => handleEditServer(serverData)}
                        title="Modifier"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="admin-action-btn admin-action-delete"
                        onClick={() => handleDeleteServer(serverData.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="admin-empty">Aucun serveur</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
