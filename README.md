# Plateforme Séminaire (React + Go)

Application intranet pour gérer:
- le partage de fichiers par classe,
- le pointage arrivée/fin des enseignants,
- les annonces broadcast admin vers étudiants,
- les notifications temps réel via SSE (alternative légère côté intranet).

## Structure

- `backend/` API Go (REST + SSE)
- `frontend/` Interface React (Vite)

## Démarrage rapide

### 1) Backend

```bash
cd backend
go run .
```

Serveur sur `http://localhost:8080`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Application sur `http://localhost:5173`.

## Comptes de démonstration

- Admin: `admin@seminaire.local`
- Enseignant: `prof@seminaire.local`
- Étudiant: `etudiant@seminaire.local`

Le mot de passe est ignoré en mode démo.

## Fonctionnalités MVP

- Authentification simple par email (rôle auto-déduit)
- Pointage enseignant: arrivée / fin de cours
- Dépôt logique de fichiers par classe (métadonnées)
- Consultation des fichiers par étudiants de la classe
- Annonces broadcast admin
- Notifications temps réel (SSE)
- Rapport admin de présence comparé à l'emploi du temps (simplifié)

> Note: cette version est un socle MVP pour démarrer vite. Le stockage de fichiers réels, la sécurité renforcée (JWT, RBAC strict), et la persistance en base de données peuvent être ajoutés ensuite.
