import { createMiddleware } from '@tanstack/react-start'

export const authMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    try {
      const cookieHeader = request.headers.get('cookie')
      
      if (!cookieHeader) {
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

      const isAuthenticated = cookies.auth_token === 'authenticated'

      if (!isAuthenticated) {
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return next()
    } catch (error) {
      console.error('Auth middleware error:', error)
      if (error instanceof Response) {
        throw error
      }
      throw new Response(JSON.stringify({ error: 'Authentication failed' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
)
