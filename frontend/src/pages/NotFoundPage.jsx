import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="page page-404">
      <div className="notfound-card">
        <h1>404</h1>
        <p>La page demandée est introuvable.</p>
        <Link to="/" className="button button-primary">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
