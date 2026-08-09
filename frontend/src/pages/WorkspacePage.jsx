import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api,
  chatSocketUrl,
  clearSession,
  getStoredSession,
  logout,
  rolePath,
} from '../services/api'
import { DiscordLayout } from '../layouts/DiscordLayout'
import { AdminPanel } from '../layouts/AdminPanel'
import { SettingsPage } from './SettingsPage'

function WorkspacePage({ expectedRole }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getStoredSession())
  const [servers, setServers] = useState([])
  const [users, setUsers] = useState([])
  const [selectedServerId, setSelectedServerId] = useState(null)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [selectedDMUserId, setSelectedDMUserId] = useState(null)
  const [messages, setMessages] = useState([])
  const [dmMessages, setDmMessages] = useState({})
  const [draft, setDraft] = useState('')
  const [dmDraft, setDmDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [mobilePanel, setMobilePanel] = useState('')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [processedMessageIds, setProcessedMessageIds] = useState(new Set())

  const user = session?.user
  const isAdmin = user?.role === 'administrator'

  const selectedServer = useMemo(
    () => servers.find((item) => item.id === selectedServerId) || null,
    [servers, selectedServerId],
  )
  
  const selectedChannel = useMemo(
    () => selectedServer?.channels?.find((item) => item.id === selectedChannelId) || null,
    [selectedServer, selectedChannelId],
  )

  const selectedDMUser = useMemo(
    () => users.find((item) => item.id === selectedDMUserId) || null,
    [users, selectedDMUserId],
  )

  const members = selectedServer?.members || []

  const loadWorkspace = useCallback(async () => {
    if (!getStoredSession()) return
    setLoading(true)
    setError('')
    try {
      const [serverData, userData] = await Promise.all([
        api.getServers(),
        api.getUsers ? api.getUsers() : Promise.resolve({ users: [] }),
      ])
      setServers(serverData.servers || [])
      setUsers(userData.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!session?.accessToken) {
      navigate('/login', { replace: true })
      return
    }
    if (expectedRole && session.user?.role !== expectedRole) {
      navigate(rolePath(session.user?.role), { replace: true })
      return
    }
    loadWorkspace()
  }, [expectedRole, loadWorkspace, navigate, session])

  useEffect(() => {
    if (!servers.length) {
      setSelectedServerId(null)
      return
    }
    if (!selectedServerId || !servers.some((serverItem) => serverItem.id === selectedServerId)) {
      setSelectedServerId(servers[0].id)
    }
  }, [selectedServerId, servers])

  useEffect(() => {
    if (!selectedServer?.channels?.length) {
      setSelectedChannelId(null)
      return
    }
    if (!selectedServer.channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(selectedServer.channels[0].id)
    }
  }, [selectedChannelId, selectedServer])

  useEffect(() => {
    let ignore = false
    async function loadChannelData() {
      if (!selectedChannel) return
      setError('')
      try {
        if (selectedChannel.type === 'chat') {
          const data = await api.getMessages(selectedChannel.id)
          if (!ignore) {
            setMessages(data.messages || [])
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message)
      }
    }
    loadChannelData()
    return () => {
      ignore = true
    }
  }, [selectedChannel])

  useEffect(() => {
    if (!session?.accessToken) return undefined
    const socket = new WebSocket(chatSocketUrl(session.accessToken))
    
    socket.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data)
        
        // Éviter les doublons en vérifiant si on a déjà traité ce message
        if (processedMessageIds.has(incoming.id)) return
        
        // Ajouter l'ID du message à la liste des IDs traités
        setProcessedMessageIds((current) => new Set(current).add(incoming.id))

        // Handle channel messages
        if (incoming.room && String(incoming.room) === String(selectedChannelId)) {
          setMessages((current) => {
            if (current.some((msg) => String(msg.id) === String(incoming.id))) return current
            return [...current, {
              id: incoming.id,
              author: incoming.author,
              role: incoming.role,
              content: incoming.text,
              createdAt: new Date().toISOString(),
            }]
          })
        }
        
        // Handle DM messages
        if (incoming.isDM && incoming.senderId) {
          setDmMessages((current) => {
            const messages = current[incoming.senderId] || []
            if (messages.some((msg) => String(msg.id) === String(incoming.id))) return current
            return {
              ...current,
              [incoming.senderId]: [...messages, {
                id: incoming.id,
                author: incoming.author,
                content: incoming.text,
                createdAt: new Date().toISOString(),
              }],
            }
          })
        }
      } catch {
        // Socket error
      }
    }
    return () => socket.close()
  }, [selectedChannelId, session?.accessToken, processedMessageIds])

  async function handleSendMessage(content) {
    if (!content.trim() || !selectedChannel) return
    setDraft('')
    setError('')

    try {
      const data = await api.sendMessage(selectedChannel.id, content)
      if (data.message) {
        // Marquer comme traité pour éviter les doublons WebSocket
        setProcessedMessageIds((current) => new Set(current).add(data.message.id))
      }
    } catch (err) {
      setDraft(content)
      setError(err.message)
    }
  }

  async function handleSendDM(content) {
    if (!content.trim() || !selectedDMUser) return
    setDmDraft('')
    setError('')

    try {
      const data = await api.sendDM?.(selectedDMUser.id, content)
      if (data?.message) {
        setDmMessages((current) => ({
          ...current,
          [selectedDMUser.id]: [...(current[selectedDMUser.id] || []), data.message],
        }))
        setProcessedMessageIds((current) => new Set(current).add(data.message.id))
      }
    } catch (err) {
      setDmDraft(content)
      setError(err.message)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      clearSession()
    } finally {
      setSession(null)
      navigate('/login', { replace: true })
    }
  }

  if (showSettings) {
    return (
      <SettingsPage
        user={user}
        onBack={() => setShowSettings(false)}
        onLogout={handleLogout}
      />
    )
  }

  if (showAdminPanel && isAdmin) {
    return (
      <AdminPanel
        user={user}
        servers={servers}
        users={users}
        onBack={() => setShowAdminPanel(false)}
        onLogout={handleLogout}
        onDataRefresh={loadWorkspace}
      />
    )
  }

  return (
    <DiscordLayout
      user={user}
      selectedServer={selectedServer}
      selectedChannel={selectedChannel}
      servers={servers}
      members={members}
      messages={messages}
      users={users}
      selectedDMUser={selectedDMUser}
      dmMessages={dmMessages[selectedDMUserId] || []}
      draft={draft}
      dmDraft={dmDraft}
      isAdmin={isAdmin}
      onSelectServer={(serverId) => {
        setSelectedServerId(serverId)
        setSelectedDMUserId(null)
      }}
      onSelectChannel={(channelId) => {
        setSelectedChannelId(channelId)
        setSelectedDMUserId(null)
      }}
      onSelectDMUser={(userId) => {
        setSelectedDMUserId(userId)
        setSelectedChannelId(null)
      }}
      onSendMessage={handleSendMessage}
      onSendDM={handleSendDM}
      onDraftChange={setDraft}
      onDMDraftChange={setDmDraft}
      onLogout={handleLogout}
      onShowAdmin={() => setShowAdminPanel(true)}
      onShowSettings={() => setShowSettings(true)}
    />
  )
}

export default WorkspacePage
