import { z } from 'zod'
import { verifyPasswordHash, createPasswordHash } from './passwordHash'

// In-memory storage for IP bans and attempts
// In production, you'd want to use Redis or a database
const ipAttempts = new Map<string, { attempts: number; lastAttempt: number; banned: boolean }>()
const MAX_ATTEMPTS = 5

// Generate a consistent salt for the same password
const SALT = 'internal-tools-salt-2024'

// Get current password from environment
function getCurrentPassword(): string {
  const envPassword = process.env.APP_PASSWORD
  console.log('🔐 Environment check:', {
    APP_PASSWORD: envPassword ? `${envPassword.substring(0, 3)}...` : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    allEnvVars: Object.keys(process.env).filter(key => key.includes('PASSWORD') || key.includes('APP'))
  })
  
  if (!envPassword) {
    console.log('⚠️  APP_PASSWORD not found in environment')
    throw new Error('APP_PASSWORD environment variable is required')
  }
  
  return envPassword
}

export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  salt: z.string().optional(),
  hashedPassword: z.string().optional(),
})

export function getClientIP(request: Request): string {
  // Try to get IP from various headers (for proxy/load balancer setups)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Fallback - in a real server environment, you'd get this from the connection
  return 'unknown'
}

export function isIPBanned(ip: string): boolean {
  const record = ipAttempts.get(ip)
  if (!record) return false
  
  // Once banned, always banned until server restart
  return record.banned
}

export function recordFailedAttempt(ip: string): { banned: boolean; remainingAttempts: number } {
  const record = ipAttempts.get(ip) || { attempts: 0, lastAttempt: 0, banned: false }
  
  record.attempts += 1
  record.lastAttempt = Date.now()
  
  if (record.attempts >= MAX_ATTEMPTS) {
    record.banned = true
  }
  
  ipAttempts.set(ip, record)
  
  return {
    banned: record.banned,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.attempts)
  }
}

export function recordSuccessfulAttempt(ip: string): void {
  // Reset attempts on successful login
  ipAttempts.delete(ip)
}

export function verifyPassword(inputPassword: string): boolean {
  const currentPassword = getCurrentPassword()
  return verifyPasswordHash(inputPassword, SALT, createPasswordHash(currentPassword, SALT))
}

export function getRemainingAttempts(ip: string): number {
  const record = ipAttempts.get(ip)
  if (!record) return MAX_ATTEMPTS
  return Math.max(0, MAX_ATTEMPTS - record.attempts)
}
