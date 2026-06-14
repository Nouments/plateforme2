import React, { useState } from 'react'
import {
  Menu,
  X,
  Users,
  Hash,
  Paperclip,
  Send,
  Search,
  LogOut,
  Plus,
  Smile,
  Gift,
} from 'lucide-react'
import './DiscordLayout.css'

export function DiscordLayout({
  user,
  selectedServer,
  selectedChannel,
  servers,
  members,
  messages,
  draft,
  onSelectServer,
  onSelectChannel,
  onSendMessage,
  onDraftChange,
  onLogout,
}) {
  const [mobileChannelVisible, setMobileChannelVisible] = useState(false)
  const [mobileMemberVisible, setMobileMemberVisible] = useState(false)

  const initials = (name = '') => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }

  const getServerColor = (index) => {
    const colors = ['#5865f2', '#2d7d46', '#703db5', '#c84b31', '#9d4a47']
    return colors[index % colors.length]
  }

  const formatTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (draft.trim()) {
      onSendMessage(draft)
      onDraftChange('')
    }
  }

  return (
    <div className="discord-app">
      {/* ========== SERVER LIST ========== */}
      <div className="discord-server-list">
        {servers.map((server, index) => (
          <button
            key={server.id}
            className={`discord-server-icon ${server.id === selectedServer?.id ? 'active' : ''}`}
            style={{ background: getServerColor(index) }}
            onClick={() => onSelectServer(server.id)}
            title={server.name}
          >
            {initials(server.name)}
          </button>
        ))}
        <div className="discord-server-sep" />
        <button className="discord-server-icon discord-server-add" title="Ajouter un serveur">
          <Plus size={20} />
        </button>
      </div>

      {/* ========== CHANNEL LIST ========== */}
      <div
        className={`discord-channel-list ${mobileChannelVisible ? 'visible' : ''}`}
        onClick={() => setMobileChannelVisible(false)}
      >
        {selectedServer && (
          <>
            <div className="discord-server-header">
              {selectedServer.name}
            </div>

            <div className="discord-channel-list-scroll">
              {/* GÉNÉRAL Section */}
              {selectedServer.channels?.some((ch) => ch.type === 'chat') && (
                <>
                  <div className="discord-channel-section">
                    GÉNÉRAL
                  </div>
                  {selectedServer.channels
                    ?.filter((ch) => ch.type === 'chat')
                    .map((channel) => (
                      <button
                        key={channel.id}
                        className={`discord-channel-item ${channel.id === selectedChannel?.id ? 'active' : ''}`}
                        onClick={() => {
                          onSelectChannel(channel.id)
                          setMobileChannelVisible(false)
                        }}
                      >
                        <Hash size={16} />
                        <span className="discord-channel-name">{channel.name}</span>
                      </button>
                    ))}
                </>
              )}

              {/* FILES Section */}
              {selectedServer.channels?.some((ch) => ch.type === 'files') && (
                <>
                  <div className="discord-channel-section">
                    FICHIERS
                  </div>
                  {selectedServer.channels
                    ?.filter((ch) => ch.type === 'files')
                    .map((channel) => (
                      <button
                        key={channel.id}
                        className={`discord-channel-item ${channel.id === selectedChannel?.id ? 'active' : ''}`}
                        onClick={() => {
                          onSelectChannel(channel.id)
                          setMobileChannelVisible(false)
                        }}
                      >
                        <Hash size={16} />
                        <span className="discord-channel-name">{channel.name}</span>
                      </button>
                    ))}
                </>
              )}
            </div>

            {/* User Bar */}
            <div className="discord-user-bar">
              <div
                className="discord-user-avatar"
                style={{ background: '#5865f2' }}
              >
                {initials(user?.name)}
              </div>
              <div className="discord-user-info">
                <div className="discord-user-name">{user?.name || 'User'}</div>
                <div className="discord-user-status">● En ligne</div>
              </div>
              <div className="discord-user-icons">
                <button
                  type="button"
                  onClick={onLogout}
                  title="Déconnexion"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========== MAIN CHAT AREA ========== */}
      <div className="discord-main">
        {/* Header */}
        <div className="discord-channel-header">
          <button
            className="icon-button"
            onClick={() => setMobileChannelVisible(!mobileChannelVisible)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              color: '#b5bac1',
              cursor: 'pointer',
              fontSize: '20px',
            }}
            aria-label="Canaux"
          >
            <Menu size={20} />
          </button>
          <Hash size={20} style={{ color: '#b5bac1' }} />
          <span className="discord-channel-header-title">
            {selectedChannel?.name || 'Canal'}
          </span>
          {selectedServer?.description && (
            <span className="discord-channel-header-desc">
              {selectedServer.description}
            </span>
          )}
          <div className="discord-header-icons">
            <button type="button" title="Notifications">
              🔔
            </button>
            <button type="button" title="Épinglés">
              📌
            </button>
            <button
              type="button"
              onClick={() => setMobileMemberVisible(!mobileMemberVisible)}
              title="Membres"
              style={{ display: 'none' }}
            >
              <Users size={20} />
            </button>
            <button type="button" title="Recherche">
              🔍
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="discord-messages">
          {messages && messages.length > 0 ? (
            messages.map((message, index) => (
              <div key={index} className="discord-msg">
                <div
                  className="discord-msg-avatar"
                  style={{
                    background: getServerColor(index),
                  }}
                >
                  {initials(message.author)}
                </div>
                <div className="discord-msg-content">
                  <div className="discord-msg-header">
                    <span className="discord-msg-author">
                      {message.author}
                    </span>
                    <span className="discord-msg-time">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  <div className="discord-msg-text">
                    {message.content}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="discord-empty-state">
              Aucun message. Commencez la conversation !
            </div>
          )}
        </div>

        {/* Input Area */}
        {selectedChannel?.type === 'chat' && (
          <div className="discord-input-area">
            <form onSubmit={handleSendMessage} className="discord-input-box">
              <button
                type="button"
                title="Joindre un fichier"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={`Envoyer un message à #${selectedChannel?.name || 'canal'}`}
              />
              <div className="discord-input-right">
                <button type="button" title="Cadeau">
                  <Gift size={18} />
                </button>
                <button type="button" title="Emoji">
                  <Smile size={18} />
                </button>
              </div>
              <button type="submit" title="Envoyer">
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ========== MEMBER LIST ========== */}
      <div
        className={`discord-member-list ${mobileMemberVisible ? 'visible' : ''}`}
        onClick={() => setMobileMemberVisible(false)}
      >
        <div className="discord-member-section">
          MEMBRES — {members?.length || 0}
        </div>

        {members && members.length > 0 ? (
          members.map((member, index) => (
            <div key={member.id} className="discord-member-item">
              <div
                className="discord-member-av"
                style={{
                  background: getServerColor(index),
                }}
              >
                {initials(member.user?.name || member.name)}
                <div className="discord-status-dot discord-dot-online" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="discord-member-name">
                  {member.user?.name || member.name}
                </div>
                <div className="discord-member-role">
                  {member.user?.role || 'Membre'}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#8e9297', padding: '12px 8px' }}>
            Aucun membre
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <style jsx>{`
        @media (max-width: 768px) {
          .icon-button[title="Canaux"] {
            display: flex !important;
            margin-right: 8px;
          }
          .icon-button[title="Membres"] {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  )
}

export default DiscordLayout
