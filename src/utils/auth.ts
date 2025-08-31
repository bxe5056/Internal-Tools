import { z } from 'zod'

// In-memory storage for IP bans and attempts
// In production, you'd want to use Redis or a database
const ipAttempts = new Map<string, { attempts: number; lastAttempt: number; banned: boolean }>()
const MAX_ATTEMPTS = 5

export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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
  const correctPassword = process.env.APP_PASSWORD || 'BANANANA'
  return inputPassword === correctPassword
}

export function getRemainingAttempts(ip: string): number {
  const record = ipAttempts.get(ip)
  if (!record) return MAX_ATTEMPTS
  return Math.max(0, MAX_ATTEMPTS - record.attempts)
}
