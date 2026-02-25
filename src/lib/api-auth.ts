import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export interface AuthUser {
  id: string
  telegramId: string
  username: string | null
  firstName: string
  photoUrl: string | null
  role: string
  project: string
  permissions: string[]
}

const tokenCache = new Map<string, { user: AuthUser; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX_SIZE = 1000

const jwtSecret = process.env.JWT_SECRET
const JWT_SECRET = jwtSecret ? new TextEncoder().encode(jwtSecret) : null

function cacheUser(token: string, user: AuthUser): void {
  // Evict expired entries if cache is full
  if (tokenCache.size >= CACHE_MAX_SIZE) {
    const now = Date.now()
    for (const [k, v] of tokenCache) {
      if (v.expires <= now) tokenCache.delete(k)
    }
    // If still full, clear oldest half
    if (tokenCache.size >= CACHE_MAX_SIZE) {
      const entries = [...tokenCache.entries()].sort((a, b) => a[1].expires - b[1].expires)
      for (let i = 0; i < entries.length / 2; i++) {
        tokenCache.delete(entries[i][0])
      }
    }
  }
  tokenCache.set(token, { user, expires: Date.now() + CACHE_TTL })
}

async function verifyJwtLocal(token: string): Promise<AuthUser | null> {
  if (!JWT_SECRET) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: 'auth-center' })

    // Service tokens need DB lookup — fall through to HTTP
    if (payload.type === 'service') return null

    // Only handle access/refresh tokens locally
    if (payload.type !== 'access' && payload.type !== 'refresh') return null

    const sub = payload.sub
    if (!sub) return null

    const project = (payload.project as string) || ''
    const permissions = (payload.permissions as string[]) || []

    // Reject tokens not for this project
    if (project && project !== 'retention_center') {
      throw new AuthError('Access denied: not authorized for this project', 403)
    }

    return {
      id: sub,
      telegramId: (payload.telegramId as string) || '',
      username: (payload.username as string) || null,
      firstName: (payload.firstName as string) || '',
      photoUrl: (payload.photoUrl as string) || null,
      role: (payload.role as string) || 'viewer',
      project: project || 'retention_center',
      permissions,
    }
  } catch (err) {
    // Re-throw AuthError (project check)
    if (err instanceof AuthError) throw err
    return null
  }
}

async function verifyTokenHttp(token: string): Promise<AuthUser> {
  const authCenterUrl = process.env.AUTH_CENTER_URL || 'https://ag4.q37fh758g.click'
  const res = await fetch(`${authCenterUrl}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ token })
  })

  if (!res.ok) {
    throw new AuthError('Invalid or expired token', 401)
  }

  const data = await res.json()
  if (!data.valid || !data.user) {
    throw new AuthError('Token verification failed', 401)
  }

  // Reject tokens not issued for this project
  if (data.project && data.project !== 'retention_center') {
    throw new AuthError('Access denied: not authorized for this project', 403)
  }

  return {
    id: data.user.id,
    telegramId: data.user.telegramId,
    username: data.user.username,
    firstName: data.user.firstName,
    photoUrl: data.user.photoUrl,
    role: data.user.role || 'viewer',
    project: data.project || 'retention_center',
    permissions: data.permissions || []
  }
}

export async function verifyApiAuth(request: NextRequest): Promise<AuthUser> {
  // Service-to-service API key bypass (for Hermes, Traffic Center, etc.)
  const serviceKey = request.headers.get('x-service-key')
  if (serviceKey && serviceKey === process.env.SERVICE_API_KEY) {
    return {
      id: 'service',
      telegramId: 'service',
      username: 'service',
      firstName: 'Service Account',
      photoUrl: null,
      role: 'admin',
      project: 'retention_center',
      permissions: ['*:*:*'],
    }
  }

  // 1. Extract token from Authorization header or ac_access cookie
  const authHeader = request.headers.get('authorization')
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = request.cookies.get('ac_access')?.value || null
  }

  if (!token) {
    throw new AuthError('No authentication token provided', 401)
  }

  // 2. Check cache
  const cached = tokenCache.get(token)
  if (cached && cached.expires > Date.now()) {
    return cached.user
  }

  // 3. Try local JWT verification first (fast, no network)
  const localUser = await verifyJwtLocal(token)
  if (localUser) {
    cacheUser(token, localUser)
    return localUser
  }

  // 4. Fallback to Auth Center HTTP (for service tokens, or if no JWT_SECRET)
  const httpUser = await verifyTokenHttp(token)
  cacheUser(token, httpUser)
  return httpUser
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * Check if user has the required permission.
 * Supports wildcard matching: "*:*:*" grants all permissions.
 * Throws AuthError(403) if permission is missing.
 */
export function requirePermission(user: AuthUser, permission: string): void {
  if (hasPermission(user, permission)) return
  throw new AuthError(`Forbidden: missing permission '${permission}'`, 403)
}

/**
 * Check if user has a specific permission (without throwing).
 * Supports wildcard segments: "*:*:*" matches everything,
 * "retention:*:*" matches all retention permissions, etc.
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  const requiredParts = permission.split(':')
  return user.permissions.some(p => {
    const parts = p.split(':')
    if (parts.length !== requiredParts.length) return false
    return parts.every((part, i) => part === '*' || part === requiredParts[i])
  })
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
