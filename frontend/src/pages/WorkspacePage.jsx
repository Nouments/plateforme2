import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Download,
  FileText,
  Folder,
  GraduationCap,
  Hash,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Server,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import {
  api,
  assetUrl,
  chatSocketUrl,
  clearSession,
  getStoredSession,
  logout,
  rolePath,
} from '../services/api'

const roleLabels = {
  administrator: 'Administrateur',
  teacher: 'Professeur',
  student: 'Étudiant',
}

const serverTypeLabels = {
  teachers: 'Serveur profs',
  community: 'Fraternité',
  class: 'Classe',
}

function WorkspacePage({ expectedRole }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getStoredSession())
  const [servers, setServers] = useState([])
  const [users, setUsers] = useState([])
  const [selectedServerId, setSelectedServerId] = useState(null)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [files, setFiles] = useState([])
  const [canUpload, setCanUpload] = useState(false)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [socketReady, setSocketReady] = useState(false)
  const [mobilePanel, setMobilePanel] = useState('')
  const [serverQuery, setServerQuery] = useState('')
  const [memberSelection, setMemberSelection] = useState([])
  const fileInputRef = useRef(null)

  const [serverForm, setServerForm] = useState({
    name: '',
    type: 'class',
    description: '',
    className: '',
    teacherIds: [],
    studentIds: [],
    memberIds: [],
  })
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'student',
    password: '',
  })

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

  const filteredServers = useMemo(() => {
    const query = serverQuery.trim().toLowerCase()
    if (!query) return servers
    return servers.filter((item) => item.name.toLowerCase().includes(query))
  }, [serverQuery, servers])

  const members = selectedServer?.members || []
  const availableMembers = users.filter(
    (candidate) => !members.some((member) => member.userId === candidate.id),
  )
  const teachers = users.filter((item) => item.role === 'teacher')
  const students = users.filter((item) => item.role === 'student')

  const showMessageComposer = selectedChannel?.type === 'chat'
  const showFileUpload = selectedChannel?.type === 'files' && canUpload

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
            setFiles([])
          }
        }
        if (selectedChannel.type === 'files') {
          const data = await api.getFiles(selectedChannel.id)
          if (!ignore) {
            setFiles(data.files || [])
            setCanUpload(Boolean(data.canUpload))
            setMessages([])
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
    socket.onopen = () => setSocketReady(true)
    socket.onclose = () => setSocketReady(false)
    socket.onerror = () => setSocketReady(false)
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
        setSocketReady(false)
      }
    }
    return () => socket.close()
  }, [selectedChannelId, session?.accessToken])

  async function handleSendMessage(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !selectedChannel) return
    setDraft('')
    setError('')
    try {
      const data = await api.sendMessage(selectedChannel.id, content)
      if (!socketReady && data.message) {
        setMessages((current) => [...current, data.message])
      }
    } catch (err) {
      setDraft(content)
      setError(err.message)
    }
  }

  async function handleUpload(event) {
    const [file] = event.target.files || []
    event.target.value = ''
    if (!file || !selectedChannel) return
    setError('')
    try {
      const data = await api.uploadFile(selectedChannel.id, file)
      setFiles((current) => [data.file, ...current])
      setNotice('Fichier ajouté')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateServer(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const payload = {
        ...serverForm,
        teacherIds: serverForm.teacherIds.map(Number),
        studentIds: serverForm.studentIds.map(Number),
        memberIds: serverForm.memberIds.map(Number),
      }
      await api.createServer(payload)
      setServerForm({
        name: '',
        type: 'class',
        description: '',
        className: '',
        teacherIds: [],
        studentIds: [],
        memberIds: [],
      })
      setNotice('Serveur créé')
      await loadWorkspace()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await api.createUser(userForm)
      setUserForm({ name: '', email: '', role: 'student', password: '' })
      setNotice('Utilisateur créé')
      await loadWorkspace()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddMembers(event) {
    event.preventDefault()
    if (!selectedServer || !memberSelection.length) return
    setError('')
    setNotice('')
    try {
      await api.addServerMembers(selectedServer.id, memberSelection.map(Number))
      setMemberSelection([])
      setNotice('Membres ajoutés')
      await loadWorkspace()
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

  function selectServer(serverId) {
    setSelectedServerId(serverId)
    setMobilePanel('')
  }

  function selectChannel(channelId) {
    setSelectedChannelId(channelId)
    setMobilePanel('')
  }

  return (
    <div className="workspace-page">
      <header className="mobile-workspace-bar">
        <button type="button" className="icon-button" onClick={() => setMobilePanel('nav')} aria-label="Ouvrir les serveurs">
          <Menu size={20} />
        </button>
        <div>
          <strong>{selectedServer?.name || 'EduConnect'}</strong>
          <span>{selectedChannel?.name || roleLabels[user?.role]}</span>
        </div>
        <button type="button" className="icon-button" onClick={() => setMobilePanel('members')} aria-label="Ouvrir les membres">
          <Users size={20} />
        </button>
      </header>

      <aside className={`workspace-sidebar ${mobilePanel === 'nav' ? 'is-open' : ''}`}>
        <div className="workspace-brand">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <div>
            <strong>EduConnect</strong>
            <span>{roleLabels[user?.role] || 'Intranet'}</span>
          </div>
          <button type="button" className="icon-button mobile-close" onClick={() => setMobilePanel('')} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={serverQuery}
            onChange={(event) => setServerQuery(event.target.value)}
            placeholder="Rechercher"
          />
        </label>

        <nav className="server-list" aria-label="Serveurs">
          {filteredServers.map((serverItem) => (
            <button
              type="button"
              key={serverItem.id}
              className={`server-pill ${serverItem.id === selectedServerId ? 'active' : ''}`}
              onClick={() => selectServer(serverItem.id)}
            >
              <span className={`server-avatar type-${serverItem.type}`}>{initials(serverItem.name)}</span>
              <span>
                <strong>{serverItem.name}</strong>
                <small>{serverTypeLabels[serverItem.type] || 'Serveur'}</small>
              </span>
            </button>
          ))}
        </nav>

        <button type="button" className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          Déconnexion
        </button>
      </aside>

      <section className="channel-panel">
        <div className="server-heading">
          <span className={`server-badge type-${selectedServer?.type || 'community'}`}>
            {selectedServer?.type === 'class' ? <BookOpen size={18} /> : <Server size={18} />}
          </span>
          <div>
            <p>{serverTypeLabels[selectedServer?.type] || 'Espace'}</p>
            <h1>{selectedServer?.name || 'Chargement'}</h1>
          </div>
        </div>

        <div className="channel-list">
          {(selectedServer?.channels || []).map((channel) => (
            <button
              type="button"
              key={channel.id}
              className={`channel-row ${channel.id === selectedChannelId ? 'active' : ''}`}
              onClick={() => selectChannel(channel.id)}
            >
              {channel.type === 'files' ? <Folder size={17} /> : <Hash size={17} />}
              <span>{channel.name}</span>
            </button>
          ))}
        </div>

        <div className="connection-state">
          {socketReady ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{socketReady ? 'Temps réel actif' : 'Temps réel en attente'}</span>
        </div>
      </section>

      <main className="workspace-main">
        <section className="conversation-header">
          <div>
            <p>{selectedServer?.description}</p>
            <h2>{selectedChannel?.name || 'Canal'}</h2>
          </div>
          {selectedChannel?.type === 'files' ? <Folder size={22} /> : <MessageSquare size={22} />}
        </section>

        {notice ? <div className="notice success">{notice}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="empty-state">Chargement de l’espace intranet...</div> : null}

        {selectedChannel?.type === 'chat' ? (
          <section className="message-area">
            <div className="messages-list">
              {messages.length ? (
                messages.map((message) => (
                  <article key={message.id} className="message-row">
                    <span className={`message-avatar role-${message.role}`}>{initials(message.author)}</span>
                    <div>
                      <header>
                        <strong>{message.author}</strong>
                        <span>{roleLabels[message.role] || message.role}</span>
                        <time>{formatTime(message.createdAt)}</time>
                      </header>
                      <p>{message.content}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">Aucun message dans ce canal.</div>
              )}
            </div>

            {showMessageComposer ? (
              <form className="composer" onSubmit={handleSendMessage}>
                <button type="button" className="icon-button" aria-label="Joindre un fichier" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={18} />
                </button>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Écrire un message"
                />
                <button type="submit" className="send-button" aria-label="Envoyer">
                  <Send size={18} />
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {selectedChannel?.type === 'files' ? (
          <section className="files-area">
            <div className="files-toolbar">
              <div>
                <strong>Documents</strong>
                <span>{files.length} fichier{files.length > 1 ? 's' : ''}</span>
              </div>
              {showFileUpload ? (
                <button type="button" className="button-primary compact" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={17} />
                  Envoyer
                </button>
              ) : null}
            </div>

            <div className="file-grid">
              {files.length ? (
                files.map((file) => (
                  <article key={file.id} className="file-card">
                    <div className="file-icon">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h3>{file.name}</h3>
                      <p>
                        {file.type} · {file.size} · {file.uploadedBy}
                      </p>
                    </div>
                    <a className="icon-button" href={assetUrl(file.url)} download aria-label={`Télécharger ${file.name}`}>
                      <Download size={18} />
                    </a>
                  </article>
                ))
              ) : (
                <div className="empty-state">Aucun fichier disponible.</div>
              )}
            </div>
          </section>
        ) : null}

        <input ref={fileInputRef} type="file" className="visually-hidden" onChange={handleUpload} />
      </main>

      <aside className={`member-panel ${mobilePanel === 'members' ? 'is-open' : ''}`}>
        <div className="panel-heading">
          <div>
            <p>Membres</p>
            <h2>{members.length}</h2>
          </div>
          <button type="button" className="icon-button mobile-close" onClick={() => setMobilePanel('')} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="member-list">
          {members.map((member) => (
            <div key={member.id} className="member-row">
              <span className={`message-avatar role-${member.user.role}`}>{initials(member.user.name)}</span>
              <div>
                <strong>{member.user.name}</strong>
                <span>{roleLabels[member.user.role] || member.user.role}</span>
              </div>
            </div>
          ))}
        </div>

        {isAdmin ? (
          <section className="admin-tools">
            <details open>
              <summary>
                <Plus size={16} />
                Créer un serveur
              </summary>
              <form onSubmit={handleCreateServer}>
                <input
                  value={serverForm.name}
                  onChange={(event) => setServerForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nom du serveur"
                />
                <select
                  value={serverForm.type}
                  onChange={(event) => setServerForm((current) => ({ ...current, type: event.target.value }))}
                >
                  <option value="class">Classe</option>
                  <option value="teachers">Serveur profs</option>
                  <option value="community">Fraternité</option>
                </select>
                {serverForm.type === 'class' ? (
                  <input
                    value={serverForm.className}
                    onChange={(event) => setServerForm((current) => ({ ...current, className: event.target.value }))}
                    placeholder="Nom de la classe"
                  />
                ) : null}
                <textarea
                  value={serverForm.description}
                  onChange={(event) => setServerForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description"
                  rows="3"
                />
                {serverForm.type === 'class' ? (
                  <>
                    <SelectMany
                      label="Professeurs"
                      value={serverForm.teacherIds}
                      options={teachers}
                      onChange={(teacherIds) => setServerForm((current) => ({ ...current, teacherIds }))}
                    />
                    <SelectMany
                      label="Étudiants"
                      value={serverForm.studentIds}
                      options={students}
                      onChange={(studentIds) => setServerForm((current) => ({ ...current, studentIds }))}
                    />
                  </>
                ) : (
                  <SelectMany
                    label="Membres"
                    value={serverForm.memberIds}
                    options={serverForm.type === 'teachers' ? users.filter((item) => item.role !== 'student') : users}
                    onChange={(memberIds) => setServerForm((current) => ({ ...current, memberIds }))}
                  />
                )}
                <button type="submit" className="button-primary">
                  <Plus size={16} />
                  Créer
                </button>
              </form>
            </details>

            <details>
              <summary>
                <UserPlus size={16} />
                Ajouter des membres
              </summary>
              <form onSubmit={handleAddMembers}>
                <SelectMany
                  label="Utilisateurs"
                  value={memberSelection}
                  options={availableMembers}
                  onChange={setMemberSelection}
                />
                <button type="submit" className="button-secondary">
                  <Users size={16} />
                  Ajouter
                </button>
              </form>
            </details>

            <details>
              <summary>
                <ShieldCheck size={16} />
                Créer un utilisateur
              </summary>
              <form onSubmit={handleCreateUser}>
                <input
                  value={userForm.name}
                  onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nom complet"
                />
                <input
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  placeholder="Email"
                />
                <select
                  value={userForm.role}
                  onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}
                >
                  <option value="student">Étudiant</option>
                  <option value="teacher">Professeur</option>
                  <option value="administrator">Administrateur</option>
                </select>
                <input
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  type="password"
                  placeholder="Mot de passe initial"
                />
                <button type="submit" className="button-primary">
                  <UserPlus size={16} />
                  Créer
                </button>
              </form>
            </details>
          </section>
        ) : null}
      </aside>
    </div>
  )
}

function SelectMany({ label, value, options, onChange }) {
  return (
    <label className="select-many">
      <span>{label}</span>
      <select
        multiple
        value={value.map(String)}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
        }
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function initials(value = '') {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default WorkspacePage
