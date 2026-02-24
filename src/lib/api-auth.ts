import { NextRequest, NextResponse } from 'next/server'

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

  // 3. Verify with Auth Center
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

  const user: AuthUser = {
    id: data.user.id,
    telegramId: data.user.telegramId,
    username: data.user.username,
    firstName: data.user.firstName,
    photoUrl: data.user.photoUrl,
    role: data.user.role || 'viewer',
    project: data.project || 'retention_center',
    permissions: data.permissions || []
  }

  // Cache for 5 minutes
  tokenCache.set(token, { user, expires: Date.now() + 5 * 60 * 1000 })

  return user
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
