import React, { useState, useEffect, useRef } from 'react'
import { Send, X } from 'lucide-react'
import { api, assetUrl } from '../services/api'
import './PrivateMessages.css'

export function PrivateMessages({ userId, userName, currentUserId, onClose }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [userId])

  const loadMessages = async () => {
    try {
      const response = await api.getPrivateMessages(userId)
      setMessages(response.messages || [])
      setLoading(false)
      scrollToBottom()
    } catch (error) {
      console.error('Erreur de chargement:', error)
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      await api.sendPrivateMessage(userId, newMessage)
      setNewMessage('')
      await loadMessages()
    } catch (error) {
      console.error('Erreur d\'envoi:', error)
    }
  }

  return (
    <div className="private-messages-modal" onClick={onClose}>
      <div className="private-messages-panel" onClick={e => e.stopPropagation()}>
        <div className="pm-header">
          <div className="pm-title">
            <span className="pm-user-name">💬 {userName}</span>
          </div>
          <button className="pm-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pm-messages">
          {loading ? (
            <div className="pm-loading">Chargement...</div>
          ) : messages.length === 0 ? (
            <div className="pm-empty">Aucun message. Commencez une conversation!</div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`pm-message ${
                  msg.senderId === currentUserId ? 'pm-message-mine' : 'pm-message-other'
                }`}
              >
                <div className="pm-message-bubble">
                  <div className="pm-message-author">
                    {msg.senderId === currentUserId ? 'Vous' : userName}
                  </div>
                  <div className="pm-message-content">{msg.content}</div>
                  <div className="pm-message-time">
                    {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="pm-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Écrivez un message..."
            className="pm-input"
          />
          <button type="submit" className="pm-send-button">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
