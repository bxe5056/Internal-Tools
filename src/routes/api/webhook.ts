import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { authMiddleware } from '~/utils/authMiddleware'

export const ServerRoute = createServerFileRoute('/api/webhook')
  .middleware([authMiddleware])
  .methods({
  POST: async ({ request }) => {
    try {
      const body = await request.json()
      const { url, status, source } = body

      if (!url || !status) {
        return json({ error: 'URL and status are required' }, { status: 400 })
      }

      // Environment variable is available on the server side
      const authToken = process.env.coreAPIToken
      if (!authToken) {
        return json({ error: 'API token not configured' }, { status: 500 })
      }

      // Encode the URL for the query parameter
      const encodedUrl = encodeURIComponent(url)
      
      // Construct the webhook URL with status and source parameters
      const webhookUrl = `https://core.bentheitguy.me/webhook/7dcd87be-7479-401f-8ed6-e97bf2bf58e8?url=${encodedUrl}&status=${status}${source ? `&source=${encodeURIComponent(source)}` : ''}`
      
      console.log('Server-side webhook call:', {
        webhookUrl,
        source,
        hasAuthToken: !!authToken,
        authTokenStart: authToken.substring(0, 10)
      })

      // Execute the request from the server
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Webhook error:', response.status, errorText)
        return json({ 
          error: `Webhook failed: ${response.status} ${response.statusText}`,
          details: errorText
        }, { status: response.status })
      }

      const result = await response.text()
      return json({ 
        success: true,
        message: `Job ${status} successfully!`,
        data: result
      })

    } catch (error) {
      console.error('Webhook API error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return json({ 
        error: 'Internal server error',
        details: errorMessage
      }, { status: 500 })
    }
  }
})