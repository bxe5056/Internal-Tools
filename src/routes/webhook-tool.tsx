import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'

// ExpandableText component for in-place text expansion
interface ExpandableTextProps {
  text: string
  maxLength: number
  className?: string
  buttonClassName?: string
}

function ExpandableText({ text, maxLength, className = '', buttonClassName = '' }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (text.length <= maxLength) {
    return <div className={className}>{text}</div>
  }
  
  return (
    <div>
      <div className={className}>
        {isExpanded ? text : `${text.substring(0, maxLength)}...`}
      </div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={buttonClassName}
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

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
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)
  const [jobToRemove, setJobToRemove] = useState<string | null>(null)
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showFilterDropdown && !target.closest('.filter-dropdown')) {
        setShowFilterDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])

  // Load existing jobs from localStorage on component mount
  useEffect(() => {
    console.log('Component mounted, loading jobs...')
    setIsLoadingJobs(true)
    setJobsError(null)
    
    const savedJobs = localStorage.getItem('printJobs')
    if (savedJobs) {
      try {
        const parsed = JSON.parse(savedJobs)
        console.log('Found saved jobs in localStorage:', parsed)
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
        console.log('Loaded jobs from localStorage:', jobsWithDates)
      } catch (e) {
        console.error('Failed to parse saved print jobs:', e)
        setJobsError('Failed to load saved jobs from localStorage')
      }
    } else {
      console.log('No saved jobs found in localStorage')
    }
  }, [])

  // Load jobs from receipt printer API after component mounts
  useEffect(() => {
    console.log('Loading jobs from receipt printer API...')
    const loadJobsFromAPI = async () => {
      try {
        const response = await fetch('https://receipts.bentheitguy.me/jobs')
        if (response.ok) {
          const jobsData = await response.json()
          console.log('Received jobs from API:', jobsData)
          
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
          
          console.log('Converted jobs array:', jobsArray)
          
          setPrintJobs(prevJobs => {
            console.log('Previous jobs from state:', prevJobs)
            
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
            console.log('Final merged jobs:', finalJobs)
            return finalJobs
          })
        } else {
          console.error('Failed to fetch jobs from API:', response.status, response.statusText)
          const errorMessage = `Failed to fetch jobs from API: ${response.status}`
          setJobsError(errorMessage)
          showToastNotification(errorMessage, 'error')
        }
      } catch (error) {
        console.error('Error loading jobs from API:', error)
        const errorMessage = `Error loading jobs from API: ${error instanceof Error ? error.message : 'Unknown error'}`
        setJobsError(errorMessage)
        showToastNotification(errorMessage, 'error')
      } finally {
        setIsLoadingJobs(false)
      }
    }
    
    // Load jobs after a short delay to ensure component is fully mounted
    const timer = setTimeout(loadJobsFromAPI, 1000)
    return () => clearTimeout(timer)
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
      const response = await fetch('https://receipts.bentheitguy.me/jobs')
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
        showToastNotification(`Failed to fetch jobs: ${response.status}`, 'error')
      }
    } catch (error) {
      console.error('Failed to update job statuses:', error)
      
      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('CORS error detected. The receipt printer may not have CORS enabled.')
        console.warn('Consider enabling CORS on the receipt printer or using a proxy.')
        showToastNotification('CORS error: Unable to connect to receipt printer', 'error')
      } else {
        showToastNotification('Failed to update job statuses', 'error')
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

    // Create immediate job card with loading state
    const newJob: PrintJob = {
      id: Date.now().toString(),
      url: url.trim(),
      status: status,
      submittedAt: new Date(),
      lastUpdated: new Date(),
      jobStatus: 'pending',
      resubmissions: []
    }
    setPrintJobs(prev => [newJob, ...prev])

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
      // Show toast notification instead of setting result
      showToastNotification(`Job ${status} successfully!`, 'success')
      // Clear the input box after successful submission
      setUrl('')
      
      // Trigger an immediate status update to populate the job data
      setTimeout(() => {
        updateJobStatuses()
      }, 2000) // Wait 2 seconds for n8n to process
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
      
      // Remove the failed job from state
      setPrintJobs(prev => prev.filter(job => job.id !== newJob.id))
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
                jobStatus: 'pending',
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
        // Create new job with loading state
         const newJob: PrintJob = {
           id: Date.now().toString(),
           url: url.trim(),
           status: 'Researching',
           submittedAt: new Date(),
           lastUpdated: new Date(),
          jobStatus: 'pending',
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
      // Show toast notification instead of setting result
      showToastNotification('Job submitted successfully! It will appear in the job history below.', 'success')
      
      // Trigger an immediate status update to get the latest data
      setTimeout(() => {
        updateJobStatuses()
      }, 2000) // Wait 2 seconds for n8n to process
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit print job to n8n'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
      
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
       
       showToastNotification('Job resubmitted to n8n successfully!', 'success')
      
      // Trigger an immediate status update
      setTimeout(() => {
        updateJobStatuses()
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resubmit to n8n'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
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
      const response = await fetch('https://receipts.bentheitguy.me/print/job', {
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
        
        showToastNotification(`Resubmitted ${job.title} at ${job.company} to receipt printer successfully!`, 'success')
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
        
        const errorMessage = 'Failed to resubmit to receipt printer. Please try again.'
        setError(errorMessage)
        showToastNotification(errorMessage, 'error')
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
      
      const errorMessage = 'An error occurred while resubmitting to receipt printer.'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
    }
  }

  const removeJob = async (jobId: string) => {
    try {
      // Call the DELETE endpoint to remove the job from the backend
      const response = await fetch(`https://receipts.bentheitguy.me/jobs/${jobId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        // Job successfully removed from backend, now remove from local state
    setPrintJobs(prev => prev.filter(job => job.id !== jobId))
        console.log('Job removed successfully')
        setJobToRemove(null) // Hide confirmation dialog
      } else {
        console.error('Failed to remove job from backend:', response.status, response.statusText)
        // Still remove from local state to maintain UI consistency
        setPrintJobs(prev => prev.filter(job => job.id !== jobId))
        setJobToRemove(null) // Hide confirmation dialog
      }
    } catch (error) {
      console.error('Error removing job:', error)
      // Remove from local state even if backend call fails
      setPrintJobs(prev => prev.filter(job => job.id !== jobId))
      setJobToRemove(null) // Hide confirmation dialog
    }
  }

  const clearAllJobs = async () => {
    try {
      // Call the DELETE endpoint to clear all jobs from the backend
      const response = await fetch('https://receipts.bentheitguy.me/jobs', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log(result.message) // "All X jobs cleared"
        // Clear all jobs from local state
        setPrintJobs([])
        showToastNotification(`All jobs cleared successfully: ${result.message}`, 'success')
        setShowClearConfirmation(false) // Hide confirmation dialog
      } else {
        console.error('Failed to clear jobs from backend:', response.status, response.statusText)
        const errorMessage = 'Failed to clear jobs from backend'
        setError(errorMessage)
        showToastNotification(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Error clearing jobs:', error)
      const errorMessage = 'Error clearing jobs from backend'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
    }
  }

  const removeBulkJobs = async () => {
    try {
      const jobIds = Array.from(selectedJobs)
      let successCount = 0
      let errorCount = 0

      // Remove each selected job individually
      for (const jobId of jobIds) {
        try {
          const response = await fetch(`https://receipts.bentheitguy.me/jobs/${jobId}`, {
            method: 'DELETE',
          })
          
          if (response.ok) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      // Update local state
      setPrintJobs(prev => prev.filter(job => !selectedJobs.has(job.id)))
      
      // Show result message
      if (errorCount === 0) {
        showToastNotification(`Successfully removed ${successCount} jobs`, 'success')
      } else {
        showToastNotification(`Removed ${successCount} jobs successfully, ${errorCount} failed`, 'success')
      }
      
      // Clear selection and hide bulk actions
      setSelectedJobs(new Set())
      setShowBulkActions(false)
    } catch (error) {
      console.error('Error removing bulk jobs:', error)
      const errorMessage = 'Error removing selected jobs'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
    }
  }

  // Filter jobs based on status filter
  const filteredJobs = printJobs.filter(job => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'success') return job.jobStatus === 'success'
    if (statusFilter === 'error') return job.jobStatus === 'error'
    if (statusFilter === 'pending') return job.jobStatus === 'pending'
    if (statusFilter === 'applied') return job.status === 'Applied'
    if (statusFilter === 'researching') return job.status === 'Researching'
    return true
  })

  // Toast notification function
  const showToastNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    
    // Auto-hide toast after 5 seconds
    setTimeout(() => {
      setShowToast(false)
    }, 5000)
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
          showToastNotification('No new jobs found in the JSON data. All jobs already exist in the history.', 'success')
          return prevJobs
        }
        
        showToastNotification(`Successfully imported ${newJobs.length} new jobs from JSON data.`, 'success')
        return [...newJobs, ...prevJobs]
      })
      
      setError(null)
    } catch (err) {
      const errorMessage = 'Invalid JSON format. Please check your data and try again.'
      setError(errorMessage)
      showToastNotification(errorMessage, 'error')
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
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job Management Dashboard</h1>
              <p className="text-sm text-gray-600">Track applications and manage print queue submissions</p>
            </div>
        </div>

          {/* Compact Tab Navigation */}
          <div className="bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('job-tracking')}
              className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'job-tracking'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Job Management
            </button>
            <button
              onClick={() => setActiveTab('import-jobs')}
              className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'import-jobs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Import Jobs
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className={`fixed top-6 right-6 z-50 max-w-md transform transition-all duration-300 ease-in-out ${
            showToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}>
            <div className={`rounded-lg shadow-lg p-4 ${
              toastType === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toastType === 'success' ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium">{toastMessage}</p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => setShowToast(false)}
                    className={`inline-flex rounded-md p-1.5 ${
                      toastType === 'success' 
                        ? 'text-green-400 hover:bg-green-100' 
                        : 'text-red-400 hover:bg-red-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-2">
          {activeTab === 'job-tracking' && (
            <div className="space-y-8">
              {/* Job Tracking Content */}
              <div>
                <label htmlFor="url" className="block text-lg font-semibold text-gray-900 mb-3">
                  Enter Job URL to Track or Print
                </label>
                <div className="flex gap-3">
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
                      className="w-full pl-12 pr-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 bg-white text-black"
                    />
                </div>

                  {/* Inline Action Buttons */}
                  <button
                    onClick={() => executeWebhook('Applied')}
                    disabled={isLoading || !url.trim()}
                    className="px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Applied
                  </button>

                  <button
                    onClick={() => executeWebhook('Researching')}
                    disabled={isLoading || !url.trim()}
                    className="px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Research
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

            </div>
          )}

        </div>

        {/* Job History Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {activeTab === 'job-tracking' && (
            <div className="">
              {/* Job History Section */}
              <div className="">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold text-gray-900">Job History</h3>
                    {printJobs.length > 0 && (
                  <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={selectedJobs.size === printJobs.length && printJobs.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobs(new Set(printJobs.map(job => job.id)))
                                setShowBulkActions(true)
                              } else {
                                setSelectedJobs(new Set())
                                setShowBulkActions(false)
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Select All
                        </label>
                        <button
                          onClick={() => setShowBulkActions(!showBulkActions)}
                          className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                            showBulkActions 
                              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Bulk Actions
                        </button>
                        
                        {/* Filter Dropdown */}
                        <div className="relative filter-dropdown">
                          <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                              statusFilter !== 'all'
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filter: {statusFilter === 'all' ? 'All' : 
                              statusFilter === 'success' ? 'Success' :
                              statusFilter === 'error' ? 'Error' :
                              statusFilter === 'pending' ? 'Pending' :
                              statusFilter === 'applied' ? 'Applied' : 'Research'}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showFilterDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <div className="py-1">
                                {[
                                  { value: 'all', label: `All Jobs (${printJobs.length})` },
                                  { value: 'success', label: `Success (${printJobs.filter(job => job.jobStatus === 'success').length})` },
                                  { value: 'error', label: `Error (${printJobs.filter(job => job.jobStatus === 'error').length})` },
                                  { value: 'pending', label: `Pending (${printJobs.filter(job => job.jobStatus === 'pending').length})` },
                                  { value: 'applied', label: `Applied (${printJobs.filter(job => job.status === 'Applied').length})` },
                                  { value: 'researching', label: `Researching (${printJobs.filter(job => job.status === 'Researching').length})` }
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => {
                                      setStatusFilter(option.value)
                                      setShowFilterDropdown(false)
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                      statusFilter === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIsLoadingJobs(true)
                        setJobsError(null)
                        const loadJobsFromAPI = async () => {
                          try {
                            const response = await fetch('https://receipts.bentheitguy.me/jobs')
                            if (response.ok) {
                              const jobsData = await response.json()
                              console.log('Manual refresh - received jobs from API:', jobsData)
                              
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
                                jobStatus: jobInfo.status === 'done' ? 'success' : jobInfo.status,
                                resubmissions: []
                              }))
                              
                              setPrintJobs(prevJobs => {
                                const existingJobsMap = new Map(prevJobs.map(job => [job.url, job]))
                                
                                const updatedJobs = jobsArray.map((remoteJob) => {
                                  const existingJob = existingJobsMap.get(remoteJob.url)
                                  
                                  if (existingJob) {
                                    return {
                                      ...existingJob,
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
                                      resubmissions: existingJob.resubmissions || []
                                    }
                                  } else {
                                    return remoteJob
                                  }
                                })
                                
                                const localJobsNotInAPI = prevJobs.filter(job => 
                                  !jobsArray.some((remoteJob) => remoteJob.url === job.url)
                                )
                                
                                return [...updatedJobs, ...localJobsNotInAPI]
                              })
                              
                              setIsLoadingJobs(false)
                            } else {
                              const errorMessage = `Failed to fetch jobs: ${response.status}`
                              setJobsError(errorMessage)
                              showToastNotification(errorMessage, 'error')
                              setIsLoadingJobs(false)
                            }
                          } catch (error) {
                            const errorMessage = `Error refreshing jobs: ${error instanceof Error ? error.message : 'Unknown error'}`
                            setJobsError(errorMessage)
                            showToastNotification(errorMessage, 'error')
                            setIsLoadingJobs(false)
                          }
                        }
                        loadJobsFromAPI()
                      }}
                      className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Jobs
                    </button>
                    
                    <button
                      onClick={() => setShowClearConfirmation(true)}
                      className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 shadow-sm"
                      title="Remove all jobs from both frontend and backend"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All Jobs
                    </button>
                    
                    {/* Job Count Display */}
                    {printJobs.length > 0 && (
                      <div className="text-sm text-gray-500 ml-4">
                        Showing {filteredJobs.length} of {printJobs.length} jobs
                      </div>
                    )}
                  </div>
                </div>

                {/* Clear All Jobs Confirmation Dialog */}
                {showClearConfirmation && (
                  <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-red-800 mb-3">Confirm Clear All Jobs</h4>
                        <p className="text-red-700 mb-4">
                          Are you sure you want to remove all {printJobs.length} jobs? This action cannot be undone and will remove jobs from both the frontend and backend.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={clearAllJobs}
                            className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Yes, Clear All Jobs
                          </button>
                          <button
                            onClick={() => setShowClearConfirmation(false)}
                            className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors bg-gray-600 text-white hover:bg-gray-700 shadow-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Individual Job Removal Confirmation Dialog */}
                {jobToRemove && (
                  <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-red-800 mb-3">Confirm Remove Job</h4>
                        <p className="text-red-700 mb-4">
                          Are you sure you want to remove this job? This action cannot be undone and will remove the job from both the frontend and backend.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => removeJob(jobToRemove)}
                            className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Yes, Remove Job
                          </button>
                          <button
                            onClick={() => setJobToRemove(null)}
                            className="px-4 py-2.5 text-sm font-medium rounded-md transition-colors bg-gray-600 text-white hover:bg-gray-700 shadow-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bulk Actions Bar */}
                {showBulkActions && selectedJobs.size > 0 && (
                  <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-800 font-medium">
                          {selectedJobs.size} job{selectedJobs.size !== 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={() => setSelectedJobs(new Set())}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          Clear Selection
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={removeBulkJobs}
                          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove Selected ({selectedJobs.size})
                        </button>
                      </div>
                    </div>
                  </div>
                )}



                {isLoadingJobs ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-lg">Loading jobs...</p>
                    <p className="text-sm">Fetching from localStorage and API</p>
                  </div>
                ) : jobsError ? (
                  <div className="text-center py-12 text-red-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg">Error loading jobs</p>
                    <p className="text-sm text-red-400">{jobsError}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : printJobs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">No jobs yet</p>
                    <p className="text-sm">Submit a URL above to get started</p>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-lg">No jobs match the current filter</p>
                    <p className="text-sm">Try changing the filter or clear it to see all jobs</p>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Show All Jobs
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        {/* Job Card Header */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                            {showBulkActions && (
                              <div className="flex-shrink-0 mr-4 mt-1">
                                <input
                                  type="checkbox"
                                  checked={selectedJobs.has(job.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedJobs)
                                    if (e.target.checked) {
                                      newSelected.add(job.id)
                                    } else {
                                      newSelected.delete(job.id)
                                    }
                                    setSelectedJobs(newSelected)
                                    if (newSelected.size === 0) {
                                      setShowBulkActions(false)
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                                />
                              </div>
                            )}
                            
                          <div className="flex-1 min-w-0">
                              {/* Job Title & Company & Location */}
                              <div className="mb-3">
                                {job.title ? (
                                  <h3 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h3>
                                ) : (
                                  <div className="h-7 bg-gray-200 rounded animate-pulse mb-1 max-w-md"></div>
                                )}
                                {job.company ? (
                                  <p className="text-lg font-medium text-gray-700 flex items-center gap-2 mb-1">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    {job.company}
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <div className="h-6 bg-gray-200 rounded animate-pulse w-48"></div>
                                  </div>
                                )}
                                {job.location && (
                                  <p className="text-base text-gray-600 flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {job.location}
                                  </p>
                                )}
                                {job.salary && (
                                  <p className="text-base text-gray-600 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                    {job.salary}
                                  </p>
                                )}
                              </div>
                              
                              {/* Status Badges and Job Details */}
                              <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {job.status}
                              </span>
                              {job.jobStatus && (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  job.jobStatus === 'success' ? 'bg-green-100 text-green-800' :
                                  job.jobStatus === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {job.jobStatus === 'success' ? '✓ Printed' :
                                   job.jobStatus === 'error' ? '✗ Error' :
                                   '⏳ Pending'}
                                </span>
                              )}
                                
                                {/* Job Details Pills */}
                                {job.rating && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <svg
                                        key={star}
                                        className={`w-3 h-3 ${star <= parseInt(job.rating || '0') ? 'text-yellow-500' : 'text-gray-300'}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                      </svg>
                                    ))}
                                      </span>
                                      )}
                                    </div>
                          </div>
                          
                            {/* Action Buttons */}
                            <div className="flex gap-2 ml-6">
                            <button
                              onClick={() => resubmitToN8n(job)}
                                className="px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                              title="Resubmit to n8n orchestration system"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                                Resubmit
                            </button>
                            
                            <button
                              onClick={() => resubmitToReceiptPrinter(job)}
                                className="px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                              title="Resubmit directly to receipt printer using stored data"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                                Print
                            </button>
                            
                            <button
                                onClick={() => setJobToRemove(job.id)}
                                className="px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 shadow-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                        
                        {/* Job Metadata */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <span className="truncate">{job.url}</span>
                              <span className="text-xs bg-gray-200 px-2 py-1 rounded whitespace-nowrap ml-auto">
                                ID: {job.id}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Submitted: {job.submittedAt.toLocaleString()}</span>
                              <span>Updated: {job.lastUpdated.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Error Message */}
                        {job.error && (
                          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                            <p className="text-red-800 text-sm">
                              <strong>Error:</strong> {job.error}
                            </p>
                          </div>
                        )}
                        
                        {/* Main Content Area */}
                        <div className="px-6 py-6">
                          {(job.title || job.company || job.location || job.salary || job.description || job.rating || job.fit_reasons) ? (
                            <div className="space-y-6">
                              
                              {/* Job Description */}
                              {job.description && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Job Description</h4>
                                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <ExpandableText 
                                      text={job.description}
                                      maxLength={800}
                                      className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap"
                                      buttonClassName="text-sm text-blue-600 hover:text-blue-800 font-medium mt-3 underline"
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {/* Fit Analysis */}
                              {job.fit_reasons && (job.fit_reasons.pro || job.fit_reasons.con) && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Fit Analysis</h4>
                                  <div className="space-y-3">
                                    {job.fit_reasons.pro && (
                                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-medium text-green-700 uppercase mb-2">Why it's a good fit</p>
                                            <ExpandableText 
                                              text={job.fit_reasons.pro}
                                              maxLength={400}
                                              className="text-sm text-green-900 leading-relaxed"
                                              buttonClassName="text-sm text-green-600 hover:text-green-800 font-medium mt-2 underline"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {job.fit_reasons.con && (
                                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mt-0.5">
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-medium text-red-700 uppercase mb-2">Potential concerns</p>
                                            <ExpandableText 
                                              text={job.fit_reasons.con}
                                              maxLength={400}
                                              className="text-sm text-red-900 leading-relaxed"
                                              buttonClassName="text-sm text-red-600 hover:text-red-800 font-medium mt-2 underline"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Data Completeness Indicator */}
                              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">Receipt preview</span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-600">Data:</span>
                                  <div className="flex items-center gap-1">
                                    {['title', 'company', 'location', 'salary', 'description', 'rating'].map(field => (
                                      <div
                                        key={field}
                                        className={`w-2 h-2 rounded-full ${
                                          job[field as keyof PrintJob] 
                                            ? 'bg-green-400' 
                                            : 'bg-gray-300'
                                        }`}
                                        title={`${field.charAt(0).toUpperCase() + field.slice(1)}: ${
                                          job[field as keyof PrintJob] ? 'Available' : 'Missing'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                                    Object.values({
                                      title: job.title,
                                      company: job.company,
                                      location: job.location,
                                      salary: job.salary,
                                      description: job.description,
                                      rating: job.rating
                                    }).filter(Boolean).length >= 4
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {Object.values({
                                      title: job.title,
                                      company: job.company,
                                      location: job.location,
                                      salary: job.salary,
                                      description: job.description,
                                      rating: job.rating
                                    }).filter(Boolean).length}/6
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Job Information</h3>
                              <p className="text-gray-600 max-w-md mx-auto">
                                AI is analyzing the job posting to extract details and create a receipt preview. This usually takes 30-60 seconds.
                              </p>
                              
                              <div className="mt-6 max-w-sm mx-auto">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                                        <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
                                      </svg>
                                    </div>
                                    <span className="text-sm text-gray-700">URL submitted</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 bg-yellow-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-gray-700">Analyzing content...</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                                    <span className="text-sm text-gray-400">Receipt ready</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Resubmission History */}
                          {job.resubmissions && job.resubmissions.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Resubmission History</h4>
                              <div className="space-y-2">
                                {job.resubmissions.map((sub, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                        sub.status === 'success' ? 'bg-green-100 text-green-800' :
                                        sub.status === 'error' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {sub.type === 'n8n' ? 'n8n' : 'Printer'} - {sub.status}
                                      </span>
                                      {sub.error && (
                                        <span className="text-red-600 text-xs">({sub.error})</span>
                                      )}
                                    </div>
                                    <span className="text-gray-500 text-xs">
                                      {sub.timestamp.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                                     </div>
                 )}
               </div>

               {/* How It Works Information Panel */}
               <div className="mt-12 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
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
                       <p>This unified tool handles both job tracking and print queue management through our secure webhook endpoint at <code className="bg-white px-2 py-1 rounded text-sm font-mono text-blue-900">core.bentheitguy.me</code></p>
                       <ul className="list-disc list-inside space-y-1 ml-4">
                         <li>Paste any job posting URL in the input field above</li>
                         <li>Choose "Mark as Applied" for jobs you've already applied to</li>
                         <li>Choose "Mark as Researching" for jobs you're still evaluating</li>
                         <li>All jobs appear in the unified history above with real-time status updates</li>
                         <li>Print jobs are automatically processed by n8n and sent to the receipt printer</li>
                         <li>Monitor all job statuses and resubmit as needed</li>
                         <li>All requests are authenticated and secure</li>
                       </ul>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'import-jobs' && (
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
                      placeholder='Paste JSON data here...'
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
                        <li>Copy the JSON response from <code className="bg-white px-1 rounded text-xs font-mono">https://receipts.bentheitguy.me/jobs</code></li>
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
          )}

        </div>

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
      </div>
    </div>
  )
}
