import { createFileRoute } from '@tanstack/react-router'
import { createAPIFileRoute } from '@tanstack/start/api'

export const Route = createAPIFileRoute('/api/webhook')({
  POST: async ({ request }) => {
    try {
      const body = await request.json()
      const { url, status } = body

      if (!url || !status) {
        return new Response(JSON.stringify({ error: 'URL and status are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Environment variable is available on the server side
      const authToken = process.env.coreAPIToken
      if (!authToken) {
        return new Response(JSON.stringify({ error: 'API token not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Encode the URL for the query parameter
      const encodedUrl = encodeURIComponent(url)
      
      // Construct the webhook URL with status parameter
      const webhookUrl = `https://core.bentheitguy.me/webhook/7dcd87be-7479-401f-8ed6-e97bf2bf58e8?url=${encodedUrl}&status=${status}`
      
      console.log('Server-side webhook call:', {
        webhookUrl,
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
        return new Response(JSON.stringify({ 
          error: `Webhook failed: ${response.status} ${response.statusText}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const result = await response.text()
      return new Response(JSON.stringify({ 
        success: true,
        message: `Job ${status} successfully!`,
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('Webhook API error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})