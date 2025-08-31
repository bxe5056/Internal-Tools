import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/api/logout').methods({
  POST: async ({ request }) => {
    try {
      // Clear the authentication cookie
      const response = json({ success: true })
      response.headers.set('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')
      
      return response
    } catch (error) {
      console.error('Error during logout:', error)
      return json({ success: false, error: 'Logout failed' }, { status: 500 })
    }
  }
})
