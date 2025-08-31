import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { loginSchema, getClientIP, isIPBanned, recordFailedAttempt, recordSuccessfulAttempt, verifyPassword } from '~/utils/auth'

export const ServerRoute = createServerFileRoute('/api/login').methods({
  POST: async ({ request }) => {
    try {
      const body = await request.json()
      const { password } = loginSchema.parse(body)
      
      const clientIP = getClientIP(request)
      
      // Check if IP is banned
      if (isIPBanned(clientIP)) {
              return json(
        { 
          success: false, 
          error: 'Too many failed attempts. This IP address is permanently banned until server restart.' 
        },
        { status: 429 }
      )
      }
      
      // Verify password
      if (verifyPassword(password)) {
        // Success - reset attempts and set session
        recordSuccessfulAttempt(clientIP)
        
        // Set a secure HTTP-only cookie
        const response = json({ success: true })
        response.headers.set('Set-Cookie', `auth_token=authenticated; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`)
        
        return response
      } else {
        // Failed attempt
        const { banned, remainingAttempts } = recordFailedAttempt(clientIP)
        
        if (banned) {
                  return json(
          { 
            success: false, 
            error: `Too many failed attempts. This IP address is now permanently banned until server restart.` 
          },
          { status: 429 }
        )
        } else {
          return json(
            { 
              success: false, 
              error: `Invalid password. ${remainingAttempts} attempts remaining before IP ban.` 
            },
            { status: 401 }
          )
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        return json({ success: false, error: error.message }, { status: 400 })
      }
      return json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
  }
})
