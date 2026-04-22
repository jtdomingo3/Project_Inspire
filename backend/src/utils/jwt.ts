import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'inspire-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h'; // 24 hour expiration

interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * Generate a JWT token
 * @param userId User ID
 * @param username Username
 * @param role User role
 * @returns JWT token
 */
export function generateToken(userId: number, username: string, role: string): string {
  const payload: TokenPayload = {
    userId,
    username,
    role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token
 * @param token JWT token
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error(`Invalid or expired token: ${(error as Error).message}`);
  }
}

/**
 * Decode a token without verification
 * @param token JWT token
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader Authorization header value
 * @returns Token or null
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
