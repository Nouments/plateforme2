import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, rolePath } from '../services/api'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email || !password) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await login(email, password)
      navigate(rolePath(session.user.role), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page-login">
      <div className="login-panel">
        <div className="login-intro">
          <span className="eyebrow">Connexion</span>
          <h1>Accédez à l’intranet scolaire</h1>
          <p>Entrez vos identifiants pour rejoindre vos serveurs et vos classes.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="votre.email@domain.com"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
            />
          </label>
          {error ? <div className="notice error">{error}</div> : null}
          <button type="submit" className="button button-primary">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
