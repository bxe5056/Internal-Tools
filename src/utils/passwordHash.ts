// Client-side password hashing utility
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  // Use Web Crypto API for secure hashing
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error('Password hashing failed:', error)
    throw new Error('Password hashing failed')
  }
}

// Generate a random salt
export const generateSalt = (): string => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Server-side password verification
export const verifyPasswordHash = async (inputPassword: string, salt: string, storedHash: string): Promise<boolean> => {
  // For server-side verification, we'll use a simple hash comparison
  // In production, you might want to use bcrypt or similar
  const encoder = new TextEncoder()
  const data = encoder.encode(inputPassword + salt)
  
  // Use Web Crypto API for consistent hashing
  const expectedHash = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(expectedHash))
  const expectedHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return expectedHashHex === storedHash
}

// Create password hash for storage
export const createPasswordHash = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  
  // Use Web Crypto API for consistent hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
