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

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
