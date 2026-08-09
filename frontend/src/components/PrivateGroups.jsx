import React, { useState, useEffect, useRef } from 'react'
import { Send, X, Plus } from 'lucide-react'
import { api } from '../services/api'
import './PrivateGroups.css'

export function PrivateGroups({ onClose }) {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMessages()
      const interval = setInterval(loadGroupMessages, 3000)
      return () => clearInterval(interval)
    }
  }, [selectedGroup])

  const loadGroups = async () => {
    try {
      const response = await api.getPrivateGroups()
      setGroups(response.groups || [])
      setLoading(false)
    } catch (error) {
      console.error('Erreur de chargement:', error)
      setLoading(false)
    }
  }

  const loadGroupMessages = async () => {
    if (!selectedGroup) return
    try {
      const response = await api.getPrivateGroupMessages(selectedGroup.id)
      setMessages(response.messages || [])
      scrollToBottom()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.name.trim()) return

    try {
      const response = await api.createPrivateGroup({
        name: newGroup.name,
        description: newGroup.description,
        memberIds: [],
      })
      setGroups([...groups, response.group])
      setNewGroup({ name: '', description: '' })
      setShowCreateForm(false)
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedGroup) return

    try {
      await api.sendPrivateGroupMessage(selectedGroup.id, newMessage)
      setNewMessage('')
      await loadGroupMessages()
    } catch (error) {
      console.error('Erreur d\'envoi:', error)
    }
  }

  if (loading) {
    return <div className="pg-loading">Chargement...</div>
  }

  return (
    <div className="private-groups-modal" onClick={onClose}>
      <div className="private-groups-panel" onClick={e => e.stopPropagation()}>
        <div className="pg-header">
          <div className="pg-title">🤝 Groupes Fraternité</div>
          <button className="pg-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pg-container">
          <div className="pg-list">
            <button
              className="pg-create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={18} />
              <span>Nouveau groupe</span>
            </button>

            {showCreateForm && (
              <form className="pg-form" onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  placeholder="Nom du groupe"
                  value={newGroup.name}
                  onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="pg-input"
                  required
                />
                <textarea
                  placeholder="Description (optionnel)"
                  value={newGroup.description}
                  onChange={e => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="pg-textarea"
                />
                <div className="pg-form-buttons">
                  <button type="submit" className="pg-submit">Créer</button>
                  <button
                    type="button"
                    className="pg-cancel"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {groups.length === 0 ? (
              <div className="pg-empty">Aucun groupe. Créez-en un!</div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className={`pg-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className="pg-item-name">{group.name}</div>
                  <div className="pg-item-members">
                    {group.members?.length || 0} membres
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pg-chat">
            {selectedGroup ? (
              <>
                <div className="pg-chat-header">
                  <div className="pg-chat-title">{selectedGroup.name}</div>
                  <div className="pg-chat-members">{selectedGroup.members?.length || 0} membres</div>
                </div>

                <div className="pg-messages">
                  {messages.length === 0 ? (
                    <div className="pg-chat-empty">Aucun message. Commencez!</div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className="pg-message">
                        <div className="pg-message-author">{msg.author}</div>
                        <div className="pg-message-content">{msg.content}</div>
                        <div className="pg-message-time">
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="pg-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..."
                    className="pg-input-field"
                  />
                  <button type="submit" className="pg-send">
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="pg-select-prompt">Sélectionnez un groupe pour commencer</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
