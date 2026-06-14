import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import {
  api,
  chatSocketUrl,
  clearSession,
  getStoredSession,
  logout,
  rolePath,
} from '../services/api'
import { DiscordLayout } from '../layouts/DiscordLayout'

function WorkspacePage({ expectedRole }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getStoredSession())
  const [servers, setServers] = useState([])
  const [users, setUsers] = useState([])
  const [selectedServerId, setSelectedServerId] = useState(null)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [mobilePanel, setMobilePanel] = useState('')

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

  const members = selectedServer?.members || []

  const loadWorkspace = useCallback(async () => {
    if (!getStoredSession()) return
    setLoading(true)
    setError('')
    try {
      const [serverData, userData] = await Promise.all([
        api.getServers(),
        isAdmin ? api.getUsers() : Promise.resolve({ users: [] }),
      ])
      setServers(serverData.servers || [])
      setUsers(userData.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

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
        if (String(incoming.room) !== String(selectedChannelId)) return
        setMessages((current) => {
          if (current.some((message) => String(message.id) === String(incoming.id))) return current
          return [
            ...current,
            {
              id: incoming.id,
              author: incoming.author,
              role: incoming.role,
              content: incoming.text,
              createdAt: new Date().toISOString(),
            },
          ]
        })
      } catch {
        // Socket error
      }
    }
    return () => socket.close()
  }, [selectedChannelId, session?.accessToken])

  async function handleSendMessage(content) {
    if (!content.trim() || !selectedChannel) return
    setError('')
    try {
      const data = await api.sendMessage(selectedChannel.id, content)
      if (data.message) {
        setMessages((current) => [...current, data.message])
      }
    } catch (err) {
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

  return (
    <DiscordLayout
      user={user}
      selectedServer={selectedServer}
      selectedChannel={selectedChannel}
      servers={servers}
      members={members}
      messages={messages}
      draft={draft}
      onSelectServer={(serverId) => {
        setSelectedServerId(serverId)
        setMobilePanel('')
      }}
      onSelectChannel={(channelId) => {
        setSelectedChannelId(channelId)
        setMobilePanel('')
      }}
      onSendMessage={handleSendMessage}
      onDraftChange={setDraft}
      onLogout={handleLogout}
    />
  )
}

export default WorkspacePage
