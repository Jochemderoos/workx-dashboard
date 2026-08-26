import { NextResponse } from 'next/server'

/**
 * Simple in-memory rate limiter for API endpoints
 * Note: This is per-instance, so in a serverless environment
 * each function instance has its own counter. For production
 * at scale, consider using Redis or a database-backed solution.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  })
  failedLoginStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      failedLoginStore.delete(key)
    }
  })
}, 60000) // Clean up every minute

interface RateLimitOptions {
  /** Maximum requests per window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
  /** Key prefix for the rate limit (e.g., 'login', 'password') */
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  retryAfter?: number // seconds until reset
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address or user ID)
 * @param options - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const { maxRequests, windowMs, keyPrefix = '' } = options
  const key = `${keyPrefix}:${identifier}`
  const now = Date.now()

  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt < now) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // Existing window
  existing.count++

  if (existing.count > maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter,
    }
  }

  return {
    success: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.resetAt,
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback - in production this should be more robust
  return 'unknown'
}

/**
 * Middleware-style rate limit check for API routes.
 * Returns a NextResponse (429) if rate limited, or null if allowed.
 */
export function withRateLimit(
  req: Request,
  options?: Partial<RateLimitOptions>
): NextResponse | null {
  const ip = getClientIp(req)
  const result = checkRateLimit(ip, {
    maxRequests: options?.maxRequests ?? 60,
    windowMs: options?.windowMs ?? 60 * 1000,
    keyPrefix: options?.keyPrefix ?? 'api',
  })
  if (!result.success) {
    return NextResponse.json(
      { error: 'Te veel verzoeken, probeer het later opnieuw' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
    )
  }
  return null
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  /** Strict rate limit for authentication: 5 requests per minute */
  auth: (identifier: string) =>
    checkRateLimit(identifier, {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'auth',
    }),

  /** Rate limit for password changes: 3 requests per 5 minutes */
  passwordChange: (identifier: string) =>
    checkRateLimit(identifier, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000, // 5 minutes
      keyPrefix: 'password',
    }),

  /** Rate limit for API: 100 requests per minute */
  api: (identifier: string) =>
    checkRateLimit(identifier, {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'api',
    }),
}

// ── Brute-force rem op inloggen ────────────────────────────────────────────
// Alléén mislukte pogingen tellen mee. Normaal inloggen raakt de limiet dus
// nooit, ook niet als het hele kantoor achter één IP zit. Bij een geslaagde
// login wordt de teller gewist. In-memory (per instance), net als hierboven:
// geen extra DB-hit op het login-pad.

const failedLoginStore = new Map<string, RateLimitEntry>()

const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000 // 10 minuten

/** Max mislukte pogingen per account (e-mail) binnen het venster */
const MAX_FAILED_PER_ACCOUNT = 8
/** Max mislukte pogingen per IP binnen het venster (password spraying) */
const MAX_FAILED_PER_IP = 25

function peekFailed(key: string, max: number): number | null {
  const entry = failedLoginStore.get(key)
  if (!entry) return null
  const now = Date.now()
  if (entry.resetAt < now) {
    failedLoginStore.delete(key)
    return null
  }
  if (entry.count >= max) return Math.ceil((entry.resetAt - now) / 1000)
  return null
}

/**
 * Geeft het aantal seconden terug dat deze login geblokkeerd is, of null als
 * inloggen gewoon mag. Verhoogt zelf geen teller.
 */
export function getLoginBlockSeconds(email: string, ip: string): number | null {
  const account = peekFailed(`login-acc:${email.toLowerCase()}`, MAX_FAILED_PER_ACCOUNT)
  if (account !== null) return account
  return peekFailed(`login-ip:${ip}`, MAX_FAILED_PER_IP)
}

function bumpFailed(key: string) {
  const now = Date.now()
  const entry = failedLoginStore.get(key)
  if (!entry || entry.resetAt < now) {
    failedLoginStore.set(key, { count: 1, resetAt: now + FAILED_LOGIN_WINDOW_MS })
    return
  }
  entry.count++
}

/** Registreer een mislukte inlogpoging (verkeerd wachtwoord of onbekend account). */
export function recordFailedLogin(email: string, ip: string) {
  bumpFailed(`login-acc:${email.toLowerCase()}`)
  bumpFailed(`login-ip:${ip}`)
}

/** Wis de teller na een geslaagde login. */
export function clearFailedLogins(email: string, ip: string) {
  failedLoginStore.delete(`login-acc:${email.toLowerCase()}`)
  failedLoginStore.delete(`login-ip:${ip}`)
}
