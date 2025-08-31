import { createMiddleware } from '@tanstack/react-start'

export const securityHeadersMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next }) => {
    const result = await next()
    
    // Add security headers to all responses
    const response = result.response
    
    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    
    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff')
    
    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY')
    
    // Prevent XSS attacks
    response.headers.set('X-XSS-Protection', '1; mode=block')
    
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Content Security Policy (basic)
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;")
    
    // Permissions Policy
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    return result
  }
)
