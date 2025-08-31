import React, { useState, useEffect } from 'react'
import { PasswordProtection } from './PasswordProtection'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/check', {
        method: 'GET',
        credentials: 'include',
      })
      
      if (response.ok) {
        const { authenticated } = await response.json()
        setIsAuthenticated(authenticated)
      }
    } catch (err) {
      console.error('Error checking auth status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <PasswordProtection onAuthenticated={handleAuthenticated} />
  }

  return <>{children}</>
}
