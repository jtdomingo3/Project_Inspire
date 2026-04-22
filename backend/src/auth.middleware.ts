import { extractToken, verifyToken } from './utils/jwt.js';

export interface AuthRequest {
  user?: {
    userId: number;
    username: string;
    role: string;
  };
}

/**
 * Authentication middleware - validates JWT tokens
 * Attaches user data to request if token is valid
 * Returns 401 if token is missing or invalid
 */
export function authMiddleware(req: any, res: any, next: any) {
  // Skip auth for public endpoints
  const publicPaths = ['/api/auth/login', '/api/health'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);

  if (!token) {
    console.error(`[AUTH] Missing token for ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    console.log(`[AUTH] Valid token for user: ${payload.username} (${req.method} ${req.path})`);
    next();
  } catch (error) {
    console.error(`[AUTH] Invalid/expired token for ${req.method} ${req.path}:`, error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based authorization middleware
 * @param requiredRoles Array of roles that are allowed
 */
export function roleMiddleware(requiredRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
