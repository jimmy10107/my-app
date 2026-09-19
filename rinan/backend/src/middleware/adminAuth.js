import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: '需要登入後台' });
  }

  try {
    req.admin = jwt.verify(token, env.adminJwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}
