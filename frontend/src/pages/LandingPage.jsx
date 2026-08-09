import { Link } from 'react-router-dom'
import { ArrowRight, FileText, MessageSquare, ShieldCheck } from 'lucide-react'

function LandingPage() {
  return (
    <div className="page page-landing">
      <section className="landing-hero">
        <div className="hero-scene" aria-hidden="true">
          <div className="scene-rail">
            <span>SP</span>
            <span>FR</span>
            <span>L1</span>
          </div>
          <div className="scene-window">
            <div className="scene-header">
              <span />
              <span />
              <span />
            </div>
            <div className="scene-layout">
              <div className="scene-nav">
                <span />
                <span />
                <span />
              </div>
              <div className="scene-thread">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className="scene-files">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="landing-hero-content">
          <span className="eyebrow">Intranet scolaire</span>
          <h1>EduConnect</h1>
          <p>
            Une messagerie interne pour les classes, les professeurs et les documents de cours,
            pilotée par l’administration de l’établissement.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="button button-primary">
              Se connecter
            </Link>
            <a href="#apercu" className="button button-secondary">
              Aperçu <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </section>

      <section id="apercu" className="features-section">
        <div className="feature-card">
          <MessageSquare size={22} />
          <h2>Canaux de classe</h2>
          <p>Chaque classe dispose d’un espace clair pour les messages et les échanges internes.</p>
        </div>
        <div className="feature-card">
          <FileText size={22} />
          <h2>Fichiers encadrés</h2>
          <p>Les documents sont centralisés, consultables et téléchargeables depuis le téléphone.</p>
        </div>
        <div className="feature-card">
          <ShieldCheck size={22} />
          <h2>Gestion admin</h2>
          <p>Les serveurs, les utilisateurs et les accès restent sous contrôle de l’établissement.</p>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
