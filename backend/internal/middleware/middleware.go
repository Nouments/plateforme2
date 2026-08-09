package middleware

import (
	"net/http"

	"educonnect/internal/auth"
	"github.com/gin-gonic/gin"
)

func JWTAuth(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authorization := c.GetHeader("Authorization")
		if authorization == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization requise"})
			return
		}

		const bearer = "Bearer "
		if len(authorization) <= len(bearer) || authorization[:len(bearer)] != bearer {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Format d'authorization invalide"})
			return
		}

		tokenString := authorization[len(bearer):]
		user, err := authService.ParseAccessToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Jeton invalide"})
			return
		}

		c.Set("user", user)
		c.Next()
	}
}
