import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'

interface PrintJob {
  id: string
  url: string
  status: 'Applied' | 'Researching'
  submittedAt: Date
  lastUpdated: Date
  error?: string
  jobStatus?: 'success' | 'error' | 'pending' // The overall job status from the API
  // Fields from the receipt printer job data
  title?: string
  company?: string
  location?: string
  salary?: string
  description?: string
  date?: string
  rating?: string
  fit_reasons?: {
    pro: string
    con: string
  }
  resubmissions: {
    timestamp: Date
    type: 'n8n' | 'printer'
    status: 'pending' | 'success' | 'error'
    error?: string
  }[]
}

export const Route = createFileRoute('/webhook-tool')({
  component: WebhookTool,
})

function WebhookTool() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<'Applied' | 'Researching' | null>(null)
  
  // Print queue state
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])
  const [isSubmittingPrint, setIsSubmittingPrint] = useState(false)
  const [activeTab, setActiveTab] = useState<'job-tracking' | 'print-queue' | 'import-jobs'>('job-tracking')
  const [corsStatus, setCorsStatus] = useState<'ok' | 'cors-error' | null>(null)

  // Load existing jobs from localStorage on component mount
  useEffect(() => {
    const savedJobs = localStorage.getItem('printJobs')
    if (savedJobs) {
      try {
        const parsed = JSON.parse(savedJobs)
        // Convert string dates back to Date objects
        const jobsWithDates = parsed.map((job: any) => ({
          ...job,
          submittedAt: new Date(job.submittedAt),
          lastUpdated: new Date(job.lastUpdated),
          resubmissions: (job.resubmissions || []).map((sub: any) => ({
            ...sub,
            timestamp: new Date(sub.timestamp)
          }))
        }))
        setPrintJobs(jobsWithDates)
      } catch (e) {
        console.error('Failed to parse saved print jobs:', e)
      }
    }
    
    // Load jobs from receipt printer API on mount
    updateJobStatuses()
  }, [])

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('printJobs', JSON.stringify(printJobs))
  }, [printJobs])

  // Poll job statuses every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateJobStatuses()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const updateJobStatuses = useCallback(async () => {
    try {
      const response = await fetch('http://receipt-printer.local:8000/jobs')
      if (response.ok) {
        const jobsData = await response.json()
        
        // The API returns an object with job IDs as keys, not an array
        // Convert the object to an array format for easier processing
        const jobsArray = Object.entries(jobsData).map(([jobId, jobInfo]: [string, any]) => ({
          id: jobId,
          url: jobInfo.data?.url || '',
          status: jobInfo.data?.status || 'Researching',
          submittedAt: new Date(jobInfo.data?.date || Date.now()),
          lastUpdated: new Date(),
          title: jobInfo.data?.title,
          company: jobInfo.data?.company,
          location: jobInfo.data?.location,
          salary: jobInfo.data?.salary,
          description: jobInfo.data?.description,
          date: jobInfo.data?.date,
          rating: jobInfo.data?.rating,
          fit_reasons: jobInfo.data?.fit_reasons,
          error: jobInfo.error,
          jobStatus: jobInfo.status === 'done' ? 'success' : jobInfo.status, // Map 'done' to 'success'
          resubmissions: [] // Initialize empty resubmissions array
        }))
        
        setPrintJobs(prevJobs => {
          console.log('Previous jobs:', prevJobs)
          console.log('Jobs from API:', jobsArray)
          
          // Create a map of existing jobs by URL for easy lookup
          const existingJobsMap = new Map(prevJobs.map(job => [job.url, job]))
          
          // Process each job from the receipt printer API
          const updatedJobs = jobsArray.map((remoteJob) => {
            const existingJob = existingJobsMap.get(remoteJob.url)
            
            if (existingJob) {
              // Update existing job with data from receipt printer
              return {
                ...existingJob,
                // Update with the full job data from receipt printer
                title: remoteJob.title || existingJob.title,
                company: remoteJob.company || existingJob.company,
                location: remoteJob.location || existingJob.location,
                salary: remoteJob.salary || existingJob.salary,
                description: remoteJob.description || existingJob.description,
                date: remoteJob.date || existingJob.date,
                rating: remoteJob.rating || existingJob.rating,
                fit_reasons: remoteJob.fit_reasons || existingJob.fit_reasons,
                lastUpdated: new Date(),
                error: remoteJob.error,
                jobStatus: remoteJob.jobStatus,
                // Keep existing resubmissions
                resubmissions: existingJob.resubmissions || []
              }
            } else {
              // This is a new job from the receipt printer that we don't have locally
              return {
                ...remoteJob,
                resubmissions: [] // Initialize empty resubmissions array
              }
            }
          })
          
          // Add any local jobs that aren't in the receipt printer API yet
          const localJobsNotInAPI = prevJobs.filter(job => 
            !jobsArray.some((remoteJob) => remoteJob.url === job.url)
          )
          
          const finalJobs = [...updatedJobs, ...localJobsNotInAPI]
          console.log('Final jobs:', finalJobs)
          return finalJobs
        })
      } else {
        console.error('Failed to fetch jobs:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to update job statuses:', error)
      
      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('CORS error detected. The receipt printer may not have CORS enabled.')
        console.warn('Consider enabling CORS on the receipt printer or using a proxy.')
      }
    }
  }, [])

  const executeWebhook = async (status: 'Applied' | 'Researching') => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setJobStatus(status)

    try {
      // Encode the URL for the query parameter
      const encodedUrl = encodeURIComponent(url.trim())
      
      // Construct the webhook URL with status parameter
      const webhookUrl = `https://core.bentheitguy.me/webhook/7dcd87be-7479-401f-8ed6-e97bf2bf58e8?url=${encodedUrl}&status=${status}`
      
      // Execute the request
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Authorization': process.env.coreAPIToken
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.text()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const submitPrintJob = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to print')
      return
    }

    setIsSubmittingPrint(true)
    setError(null)

         try {
       // Check if a job with this URL already exists
       const existingJob = printJobs.find(job => job.url === url.trim())
       
       if (existingJob) {
         // Update existing job instead of creating a new one
         setPrintJobs(prev => prev.map(job => 
           job.url === url.trim() 
             ? {
                 ...job,
                 lastUpdated: new Date(),
                 resubmissions: [
                   ...job.resubmissions,
                   {
                     timestamp: new Date(),
                     type: 'n8n',
                     status: 'pending'
                   }
                 ]
               }
             : job
         ))
       } else {
         // Create new job
         const newJob: PrintJob = {
           id: Date.now().toString(),
           url: url.trim(),
           status: 'Researching',
           submittedAt: new Date(),
           lastUpdated: new Date(),
           resubmissions: [{
             timestamp: new Date(),
             type: 'n8n',
             status: 'pending'
           }]
         }
         setPrintJobs(prev => [newJob, ...prev])
       }

      // Submit to n8n orchestration system (same as job tracking)
      const encodedUrl = encodeURIComponent(url.trim())
      const webhookUrl = `https://core.bentheitguy.me/webhook/7dcd87be-7479-401f-8ed6-e97bf2bf58e8?url=${encodedUrl}&status=Researching`
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic YnhlNTA1Njp3VTkwYlg3NGZnS0RNMXpCRnd4bjJDZDc1JmJANDJ4czFLIW5NeEY2KjRZcFRCQEg1Ujg1MDVLa0JHSmEzcmFe'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to submit to n8n: ${response.status}`)
      }

      setUrl('')
      setResult('Print job submitted to n8n successfully! The receipt printer will process it automatically.')
      
      // Trigger an immediate status update to get the latest data
      setTimeout(() => {
        updateJobStatuses()
      }, 2000) // Wait 2 seconds for n8n to process
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit print job to n8n')
      
      // Remove the failed job from state
      setPrintJobs(prev => prev.filter(job => job.id !== Date.now().toString()))
    } finally {
      setIsSubmittingPrint(false)
    }
  }

  const resubmitToN8n = async (job: PrintJob) => {
    try {
      setError(null)
      setResult(null)

      // Submit to n8n orchestration system
      const encodedUrl = encodeURIComponent(job.url)
      const webhookUrl = `https://core.bentheitguy.me/webhook/7dcd87be-7479-401f-8ed6-e97bf2bf58e8?url=${encodedUrl}&status=${job.status}`
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic YnhlNTA1Njp3VTkwYlg3NGZnS0RNMXpCRnd4bjJDZDc1JmJANDJ4czFLIW5NeEY2KjRZcFRCQEg1Ujg1MDVLa0JHSmEzcmFe'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to resubmit to n8n: ${response.status}`)
      }

             // Add resubmission record to existing job
       setPrintJobs(prev => prev.map(j => 
         j.id === job.id 
           ? {
               ...j,
               lastUpdated: new Date(),
               resubmissions: [
                 ...j.resubmissions,
                 {
                   timestamp: new Date(),
                   type: 'n8n',
                   status: 'success'
                 }
               ]
             }
           : j
       ))
       
       setResult(`Job resubmitted to n8n successfully!`)
      
      // Trigger an immediate status update
      setTimeout(() => {
        updateJobStatuses()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resubmit to n8n')
    }
  }

  const resubmitToReceiptPrinter = async (job: PrintJob) => {
    try {
      // Check if we have the formatted data needed for direct printing
      if (!job.title || !job.company || !job.description) {
        setError('Cannot resubmit to printer: Missing formatted job data. Try resubmitting to n8n first.')
        return
      }

      // Add resubmission record
      setPrintJobs(prev => prev.map(j => 
        j.id === job.id 
          ? {
              ...j,
              lastUpdated: new Date(),
              resubmissions: [
                ...j.resubmissions,
                {
                  timestamp: new Date(),
                  type: 'printer',
                  status: 'pending'
                }
              ]
            }
          : j
      ))

      // Send directly to receipt printer
      const response = await fetch('http://receipt-printer.local:8000/print/job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location || 'N/A',
          salary: job.salary || 'N/A',
          description: job.description,
          url: job.url,
          date: job.date || new Date().toISOString(),
          status: job.status,
          rating: job.rating || 'N/A',
          fit_reasons: job.fit_reasons || { pro: 'N/A', con: 'N/A' }
        }),
      })

      if (response.ok) {
        // Update resubmission status to success
        setPrintJobs(prev => prev.map(j => 
          j.id === job.id 
            ? {
                ...j,
                resubmissions: j.resubmissions.map(sub => 
                  sub.timestamp.getTime() === Date.now() - 1000 // Roughly match the recent submission
                    ? { ...sub, status: 'success' as const }
                    : sub
                )
              }
            : j
        ))
        
        setResult(`Resubmitted ${job.title} at ${job.company} to receipt printer successfully!`)
      } else {
        // Update resubmission status to error
        setPrintJobs(prev => prev.map(j => 
          j.id === job.id 
            ? {
                ...j,
                resubmissions: j.resubmissions.map(sub => 
                  sub.timestamp.getTime() === Date.now() - 1000 // Roughly match the recent submission
                    ? { ...sub, status: 'error' as const, error: 'Failed to submit to printer' }
                    : sub
                )
              }
            : j
        ))
        
        setError('Failed to resubmit to receipt printer. Please try again.')
      }
    } catch (error) {
      console.error('Error resubmitting to receipt printer:', error)
      
      // Update resubmission status to error
      setPrintJobs(prev => prev.map(j => 
        j.id === job.id 
          ? {
              ...j,
              resubmissions: j.resubmissions.map(sub => 
                sub.timestamp.getTime() === Date.now() - 1000 // Roughly match the recent submission
                  ? { ...sub, status: 'error' as const, error: 'Network error' }
                  : sub
              )
            }
          : j
      ))
      
      setError('An error occurred while resubmitting to receipt printer.')
    }
  }

  const removeJob = (jobId: string) => {
    setPrintJobs(prev => prev.filter(job => job.id !== jobId))
  }

  const importJobsFromJSON = (jsonData: string) => {
    try {
      const parsedData = JSON.parse(jsonData)
      
      // Convert the object-based API response to array format
      const importedJobs = Object.entries(parsedData).map(([jobId, jobInfo]: [string, any]) => ({
        id: jobId,
        url: jobInfo.data?.url || '',
        status: jobInfo.data?.status || 'Researching',
        submittedAt: new Date(jobInfo.data?.date || Date.now()),
        lastUpdated: new Date(),
        title: jobInfo.data?.title,
        company: jobInfo.data?.company,
        location: jobInfo.data?.location,
        salary: jobInfo.data?.salary,
        description: jobInfo.data?.description,
        date: jobInfo.data?.date,
        rating: jobInfo.data?.rating,
        fit_reasons: jobInfo.data?.fit_reasons,
        error: jobInfo.error,
        jobStatus: jobInfo.status === 'done' ? 'success' : jobInfo.status, // Map 'done' to 'success'
        resubmissions: [] // Initialize empty resubmissions array
      }))

      // Merge with existing jobs, avoiding duplicates by URL
      setPrintJobs(prevJobs => {
        const existingUrls = new Set(prevJobs.map(job => job.url))
        const newJobs = importedJobs.filter(job => !existingUrls.has(job.url))
        
        if (newJobs.length === 0) {
          setResult('No new jobs found in the JSON data. All jobs already exist in the history.')
          return prevJobs
        }
        
        setResult(`Successfully imported ${newJobs.length} new jobs from JSON data.`)
        return [...newJobs, ...prevJobs]
      })
      
      setError(null)
    } catch (err) {
      setError('Invalid JSON format. Please check your data and try again.')
      setResult(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && url.trim()) {
      if (activeTab === 'job-tracking') {
        executeWebhook('Applied')
      } else {
        submitPrintJob()
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Internal Tools Dashboard
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto">
            Job tracking and print queue management in one place.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl p-1 shadow-lg border border-gray-200">
            <button
              onClick={() => setActiveTab('job-tracking')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'job-tracking'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Job Tracking
            </button>
            <button
              onClick={() => setActiveTab('print-queue')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'print-queue'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Print Queue
            </button>
            <button
              onClick={() => setActiveTab('import-jobs')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'import-jobs'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Import Jobs
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {activeTab === 'job-tracking' ? (
            <div className="space-y-8">
              {/* Job Tracking Content */}
              <div>
                <label htmlFor="url" className="block text-lg font-semibold text-gray-900 mb-3">
                  Enter Job URL to Process
                </label>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <input
                      type="url"
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="https://example.com/job-posting"
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => executeWebhook('Applied')}
                    disabled={isLoading || !url.trim()}
                    className="px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark as Applied
                  </button>

                  <button
                    onClick={() => executeWebhook('Researching')}
                    disabled={isLoading || !url.trim()}
                    className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Mark as Researching
                  </button>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center justify-center">
                {isLoading && (
                  <div className="flex items-center gap-3 text-blue-700">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">
                      Processing job URL as {jobStatus ? jobStatus : '...'}...
                    </span>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-800 mb-2">Request Failed</h3>
                      <div className="text-red-800 bg-white p-4 rounded-lg border border-red-200">
                        {error}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Result Display */}
              {result && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-800 mb-3">
                        Job {jobStatus} Successfully
                      </h3>
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{result}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Information Panel */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">How It Works</h3>
                    <div className="text-blue-800 space-y-2">
                      <p>This tool processes job URLs through our secure webhook endpoint at <code className="bg-white px-2 py-1 rounded text-sm font-mono text-blue-900">core.bentheitguy.me</code></p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Paste any job posting URL in the input field above</li>
                        <li>Choose "Mark as Applied" for jobs you've already applied to</li>
                        <li>Choose "Mark as Researching" for jobs you're still evaluating</li>
                        <li>The webhook will receive the URL with a <code className="bg-white px-1 rounded text-xs font-mono">status</code> parameter</li>
                        <li>View real-time results and any error messages</li>
                        <li>All requests are authenticated and secure</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'print-queue' ? (
            <div className="space-y-8">
              {/* Print Queue Content */}
              <div>
                <label htmlFor="print-url" className="block text-lg font-semibold text-gray-900 mb-3">
                  Enter URL to Print
                </label>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="url"
                      id="print-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="https://example.com/document-to-print"
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 bg-white"
                    />
                  </div>
                  <button
                    onClick={submitPrintJob}
                    disabled={isSubmittingPrint || !url.trim()}
                    className="px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    {isSubmittingPrint ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    )}
                    Submit Print Job
                  </button>
                </div>
              </div>

              {/* Print Job History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Print Job History</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        updateJobStatuses()
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>

                {printJobs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">No print jobs yet</p>
                    <p className="text-sm">Submit a URL above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {printJobs.map((job) => (
                      <div key={job.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {job.status}
                              </span>
                              {job.jobStatus && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  job.jobStatus === 'success' ? 'bg-green-100 text-green-800' :
                                  job.jobStatus === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {job.jobStatus === 'success' ? '✓ Success' :
                                   job.jobStatus === 'error' ? '✗ Error' :
                                   '⏳ Pending'}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                ID: {job.id}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 truncate">{job.url}</p>
                            {job.title && (
                              <p className="text-sm font-medium text-gray-800 mt-1">
                                {job.title} at {job.company}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>Submitted: {job.submittedAt.toLocaleString()}</span>
                              <span>Updated: {job.lastUpdated.toLocaleString()}</span>
                            </div>
                            {job.error && (
                              <p className="text-red-600 text-sm mt-1">Error: {job.error}</p>
                            )}
                            
                            {/* Resubmission History */}
                            {job.resubmissions && job.resubmissions.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs font-medium text-gray-700">Resubmission History:</p>
                                <div className="space-y-1">
                                  {job.resubmissions.map((sub, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        sub.status === 'success' ? 'bg-green-100 text-green-800' :
                                        sub.status === 'error' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {sub.type === 'n8n' ? 'n8n' : 'Printer'} - {sub.status}
                                      </span>
                                      <span className="text-gray-500">
                                        {sub.timestamp.toLocaleString()}
                                      </span>
                                      {sub.error && (
                                        <span className="text-red-600">({sub.error})</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => resubmitToN8n(job)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                              title="Resubmit to n8n orchestration system"
                            >
                              Resubmit to n8n
                            </button>
                            <button
                              onClick={() => resubmitToReceiptPrinter(job)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                              title="Resubmit directly to receipt printer using stored data"
                            >
                              Resubmit to Printer
                            </button>
                            <button
                              onClick={() => removeJob(job.id)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Information Panel */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900 mb-3">Print Queue Information</h3>
                    <div className="text-purple-800 space-y-2">
                      <p>Submit URLs to be processed by n8n and printed by the receipt printer device.</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Enter any URL you want to print in the input field above</li>
                        <li>Click "Submit Print Job" to send to n8n orchestration system</li>
                        <li>n8n processes the URL and sends formatted data to the receipt printer</li>
                        <li>Monitor job status in real-time with automatic updates</li>
                        <li><strong>Two resubmission options:</strong></li>
                        <ul className="list-disc list-inside space-y-1 ml-4 mt-1">
                          <li><strong>Resubmit to n8n:</strong> Sends URL + Status to n8n for reprocessing</li>
                          <li><strong>Resubmit to Printer:</strong> Uses stored formatted data to print directly</li>
                        </ul>
                        <li>Job statuses are automatically refreshed every 30 seconds</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'import-jobs' ? (
            <div className="space-y-8">
              {/* Import Jobs Content */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Import Jobs from JSON Data
                </h3>
                <p className="text-gray-600 mb-4">
                  Paste the JSON response from the receipt printer's <code className="bg-gray-100 px-2 py-1 rounded text-sm">/jobs</code> endpoint to import jobs into your history.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="json-input" className="block text-sm font-medium text-gray-700 mb-2">
                      JSON Data
                    </label>
                    <textarea
                      id="json-input"
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder='Paste your /jobs JSON response here...'
                      onChange={(e) => {
                        // Clear any previous results when user starts typing
                        if (e.target.value.trim()) {
                          setResult(null)
                          setError(null)
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const textarea = document.getElementById('json-input') as HTMLTextAreaElement
                        if (textarea && textarea.value.trim()) {
                          importJobsFromJSON(textarea.value.trim())
                        } else {
                          setError('Please paste some JSON data first.')
                        }
                      }}
                      className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Import Jobs
                    </button>
                    
                    <button
                      onClick={() => {
                        const textarea = document.getElementById('json-input') as HTMLTextAreaElement
                        if (textarea) {
                          textarea.value = ''
                        }
                        setResult(null)
                        setError(null)
                      }}
                      className="px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Information Panel */}
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-3">Import Jobs Information</h3>
                    <div className="text-green-800 space-y-2">
                      <p>This tool allows you to manually import job data from the receipt printer's <code className="bg-white px-2 py-1 rounded text-sm font-mono text-green-900">/jobs</code> endpoint.</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Copy the JSON response from <code className="bg-white px-1 rounded text-xs font-mono">http://receipt-printer.local:8000/jobs</code></li>
                        <li>Paste it into the textarea above</li>
                        <li>Click "Import Jobs" to add them to your history</li>
                        <li>Duplicate jobs (by URL) will be automatically filtered out</li>
                        <li>Imported jobs will have the same functionality as auto-loaded jobs</li>
                        <li>Useful for debugging, testing, or manual data synchronization</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Error Display for Print Queue and Import Jobs */}
          {(activeTab === 'print-queue' || activeTab === 'import-jobs') && error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mt-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Print Job Failed</h3>
                  <div className="text-red-800 bg-white p-4 rounded-lg border border-red-200">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Result Display for Print Queue and Import Jobs */}
          {(activeTab === 'print-queue' || activeTab === 'import-jobs') && result && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mt-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">
                    {activeTab === 'print-queue' ? 'Print Job Submitted Successfully' : 'Operation Completed Successfully'}
                  </h3>
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{result}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
