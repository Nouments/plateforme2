import { Link, useNavigate } from 'react-router-dom'

function DashboardLayout({ role, children }) {
  const navigate = useNavigate()

  return (
    <div className="page page-dashboard">
      <div className="sidebar-dashboard">
        <div className="brand-block">
          <strong>Plateforme</strong>
          <span>{role}</span>
        </div>
        <nav className="dashboard-nav">
          <Link to={`/${role === 'Administrateur' ? 'admin' : role === 'Enseignant' ? 'teacher' : 'student'}`} className="nav-link active">
            Tableau de bord
          </Link>
          <button type="button" className="nav-link" onClick={() => navigate('/login')}>
            Déconnexion
          </button>
        </nav>
        <div className="info-card">
          <h4>Rôle</h4>
          <p>{role}</p>
        </div>
      </div>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Espace {role.toLowerCase()}</p>
            <h1>Bienvenue</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="button-secondary" onClick={() => navigate('/')}>Voir le landing</button>
          </div>
        </header>
        <section className="dashboard-content">{children}</section>
      </main>
    </div>
  )
}

export default DashboardLayout
