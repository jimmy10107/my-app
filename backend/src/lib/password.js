import bcrypt from 'bcryptjs';

export async function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, 10);
}

export async function comparePassword(rawPassword, hashedPassword) {
  return bcrypt.compare(rawPassword, hashedPassword);
}
