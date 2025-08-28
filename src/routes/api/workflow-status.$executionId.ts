import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/api/workflow-status/$executionId').methods({
  GET: async ({ request, params }) => {
    try {
      const { executionId } = params

      if (!executionId) {
        return json({ error: 'Execution ID is required' }, { status: 400 })
      }

      // Environment variable is available on the server side
      const n8nApiKey = process.env.N8N_API_KEY
      if (!n8nApiKey) {
        return json({ error: 'N8N API key not configured' }, { status: 500 })
      }

      // Use the v1 API to get workflow execution status
      const statusUrl = `https://core.bentheitguy.me/api/v1/executions/${executionId}`
      
      console.log('Checking workflow status:', {
        statusUrl,
        executionId,
        hasN8nApiKey: !!n8nApiKey
      })

      // Fetch execution details from the v1 API
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Workflow status API error:', response.status, errorText)
        return json({ 
          error: `Failed to get workflow status: ${response.status} ${response.statusText}`,
          details: errorText,
          executionId
        }, { status: response.status })
      }

      const executionData = await response.json()
      
      // Extract relevant status information
      const statusInfo = {
        executionId,
        status: executionData.status || 'unknown', // running, success, error, etc.
        startedAt: executionData.startedAt,
        stoppedAt: executionData.stoppedAt,
        mode: executionData.mode,
        workflowId: executionData.workflowId,
        // Extract current step information if available
        currentStep: extractCurrentStep(executionData),
        steps: extractWorkflowSteps(executionData),
        progress: calculateProgress(executionData),
        error: executionData.error,
        data: executionData.data
      }

      console.log('Workflow status extracted:', statusInfo)

      return json({ 
        success: true,
        execution: statusInfo
      })

    } catch (error) {
      console.error('Workflow status check error:', error)
      return json({ 
        error: 'Failed to check workflow status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }
})

// Helper function to extract current workflow step
function extractCurrentStep(executionData: any): string | null {
  if (!executionData.data) return null
  
  // Look for the last executed node
  const nodes = Object.keys(executionData.data)
  if (nodes.length === 0) return 'Starting workflow...'
  
  const lastNode = nodes[nodes.length - 1]
  return `Executing: ${lastNode}`
}

// Helper function to extract workflow steps
function extractWorkflowSteps(executionData: any): Array<{step: string, status: 'completed' | 'running' | 'pending', timestamp?: string}> {
  const steps = []
  
  if (!executionData.data) {
    return [
      { step: 'Initialize workflow', status: executionData.status === 'running' ? 'running' : 'pending' }
    ]
  }

  const nodeData = executionData.data
  for (const [nodeName, nodeInfo] of Object.entries(nodeData)) {
    const nodeArray = nodeInfo as any[]
    if (nodeArray && nodeArray.length > 0) {
      const lastExecution = nodeArray[nodeArray.length - 1]
      steps.push({
        step: nodeName,
        status: lastExecution.error ? 'error' : 'completed',
        timestamp: lastExecution.startTime || lastExecution.executionTime
      })
    }
  }
  
  return steps
}

// Helper function to calculate workflow progress
function calculateProgress(executionData: any): number {
  if (executionData.status === 'success') return 100
  if (executionData.status === 'error') return 0
  if (!executionData.data) return 10
  
  // Rough progress calculation based on executed nodes
  const totalSteps = Object.keys(executionData.data).length
  return Math.min(90, (totalSteps * 20)) // Cap at 90% until completion
}