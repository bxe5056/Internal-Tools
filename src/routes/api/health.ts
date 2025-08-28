import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/api/health').methods({
  GET: async () => {
    // Simple health check endpoint that returns immediately
    return json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }
})