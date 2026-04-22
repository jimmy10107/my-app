import { verifyAccessToken } from '../lib/jwt.js';
import { getUserBundleById } from '../services/user.service.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ message: '未登入' });
    const decoded = verifyAccessToken(token);
    const user = await getUserBundleById(decoded.userId);
    if (!user) return res.status(401).json({ message: '登入已失效' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token 驗證失敗' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const ok = roles.some((role) => allowedRoles.includes(role));
    if (!ok) return res.status(403).json({ message: '權限不足' });
    next();
  };
}
