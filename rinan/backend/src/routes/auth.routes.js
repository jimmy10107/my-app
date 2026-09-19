import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authRouter = Router();

// 後台用簡單密碼登入即可（單一值班帳號情境）；之後如需多人分權可再擴充成使用者表。
authRouter.post('/login', (req, res) => {
  const { password } = req.body || {};

  if (typeof password !== 'string' || password !== env.adminPassword) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  const token = jwt.sign({ role: 'admin' }, env.adminJwtSecret, { expiresIn: '12h' });
  res.json({ token });
});
