/**
 * Token Manager - Gère l'expiration du token et le logout automatique
 */

export function getTokenExpiration(token) {
  if (!token) return null
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const decoded = JSON.parse(atob(parts[1]))
    return decoded.exp ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const expiration = getTokenExpiration(token)
  if (!expiration) return true
  return Date.now() >= expiration
}

export function getTimeUntilExpiration(token) {
  const expiration = getTokenExpiration(token)
  if (!expiration) return null
  
  const timeLeft = expiration - Date.now()
  return timeLeft > 0 ? timeLeft : 0
}

export function setupTokenExpirationCheck(accessToken, onExpire, checkInterval = 60000) {
  if (!accessToken) return null
  
  const expiration = getTokenExpiration(accessToken)
  if (!expiration) return null
  
  // Ajouter 30 secondes de buffer avant l'expiration réelle
  const expirationBuffer = expiration - 30000
  const now = Date.now()
  
  if (now >= expirationBuffer) {
    // Token est déjà expiré ou sur le point d'expirer
    onExpire()
    return null
  }
  
  // Calculer le délai avant appel du callback
  const delay = expirationBuffer - now
  
  // Mettre en place une vérification périodique avec un timeout principal
  const timeoutId = setTimeout(() => {
    onExpire()
  }, delay)
  
  // Ajouter une vérification périodique pour plus de fiabilité
  const intervalId = setInterval(() => {
    if (isTokenExpired(accessToken)) {
      clearTimeout(timeoutId)
      onExpire()
    }
  }, checkInterval)
  
  return {
    timeoutId,
    intervalId,
    cleanup: () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }
}

export function formatTimeRemaining(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return 'Expiré'
  
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}j ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}
