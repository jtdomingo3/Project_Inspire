import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'inspire-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

export function generateToken(userId, username, role) {
  const payload = {
    userId,
    username,
    role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error(`Invalid or expired token: ${error.message}`);
  }
}

export function decodeToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded;
  } catch {
    return null;
  }
}

export function extractToken(authHeader) {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
