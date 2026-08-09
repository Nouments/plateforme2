import React from 'react'
import './UserStatus.css'

export function UserStatus({ user, isOnline, size = 'md' }) {
  if (!user) return null

  const getInitials = (name = '') => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }

  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'administrator':
        return '#ed4245' // Red
      case 'teacher':
        return '#5865f2' // Blue
      case 'student':
        return '#3ba55d' // Green
      default:
        return '#8e9297'
    }
  }

  return (
    <div className={`user-status user-status-${size}`}>
      <div 
        className="user-avatar"
        style={{ borderColor: getRoleColor(user.role) }}
      >
        {getInitials(user.name)}
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`} />
      </div>
      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className={`user-online-status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
        </div>
      </div>
    </div>
  )
}

export function UserStatusBadge({ isOnline, hideText = false }) {
  return (
    <div className={`user-status-badge ${isOnline ? 'online' : 'offline'}`}>
      <span className="badge-dot" />
      {!hideText && (
        <span className="badge-text">
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </span>
      )}
    </div>
  )
}

export function UserStatusIndicator({ isOnline }) {
  return (
    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
  )
}
