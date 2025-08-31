import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/api/check').methods({
  GET: async ({ request }) => {
    try {
      const cookieHeader = request.headers.get('cookie')
      
      if (!cookieHeader) {
        return json({ authenticated: false })
      }
      
      // Check if auth_token cookie exists and is valid
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      
      const isAuthenticated = cookies.auth_token === 'authenticated'
      
      return json({ authenticated: isAuthenticated })
    } catch (error) {
      console.error('Error checking authentication:', error)
      return json({ authenticated: false })
    }
  }
})
