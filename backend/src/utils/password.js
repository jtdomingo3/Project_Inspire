import bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}
