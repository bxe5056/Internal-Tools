import React, { useState, useEffect } from 'react'
import { hashPassword, generateSalt } from '~/utils/passwordHash'

interface PasswordProtectionProps {
  onAuthenticated: () => void
}

export function PasswordProtection({ onAuthenticated }: PasswordProtectionProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    // Check if user is already authenticated
    checkExistingAuth()
  }, [])

  const checkExistingAuth = async () => {
    try {
      const response = await fetch('/api/check', {
        method: 'GET',
        credentials: 'include',
      })
      
      if (response.ok) {
        const { authenticated } = await response.json()
        if (authenticated) {
          onAuthenticated()
          return
        }
      }
    } catch (err) {
      console.error('Error checking auth:', err)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Generate salt and hash password
      const salt = generateSalt()
      const hashedPassword = await hashPassword(password, salt)

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          password,
          salt,
          hashedPassword 
        }),
      })

      if (response.ok) {
        const { success } = await response.json()
        if (success) {
          onAuthenticated()
          return
        }
      } else {
        const { error: errorMessage } = await response.json()
        setError(errorMessage || 'Authentication failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Internal Tools Access
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter the password to continue
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </div>
              ) : (
                'Access Tools'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
