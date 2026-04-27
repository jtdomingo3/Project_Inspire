import { decodeToken, extractToken, verifyToken } from './utils/jwt.js';

export function authMiddleware(req, res, next) {
  // Allow CORS preflight requests to pass through without authentication
  if (req.method === 'OPTIONS') {
    return next();
  }

  const publicPaths = [
    '/api/auth/login',
    '/api/health',
    '/api/setup/status',
    '/api/setup/bootstrap'
  ];

  // Allow exact matches or subpaths (e.g. trailing slash) for public endpoints
  if (publicPaths.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
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
    if (req.path === '/api/auth/refresh') {
      const decoded = decodeToken(token);
      if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
        req.user = decoded;
        return next();
      }
    }
    console.error(`[AUTH] Invalid/expired token for ${req.method} ${req.path}:`, error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function roleMiddleware(requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
