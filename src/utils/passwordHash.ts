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
export const verifyPasswordHash = (inputPassword: string, salt: string, storedHash: string): boolean => {
  // For server-side verification, we'll use a simple hash comparison
  // In production, you might want to use bcrypt or similar
  const expectedHash = require('crypto')
    .createHash('sha256')
    .update(inputPassword + salt)
    .digest('hex')
  
  return expectedHash === storedHash
}

// Create password hash for storage
export const createPasswordHash = (password: string, salt: string): string => {
  return require('crypto')
    .createHash('sha256')
    .update(password + salt)
    .digest('hex')
}
