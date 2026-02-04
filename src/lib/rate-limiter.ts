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
