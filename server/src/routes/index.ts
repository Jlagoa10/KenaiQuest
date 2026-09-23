import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { userRoutes } from './userRoutes.js';
import { goalRoutes } from './goalRoutes.js';
import { collectibleRoutes } from './collectibleRoutes.js';
import { tradeRoutes } from './tradeRoutes.js';
import { competitionRoutes } from './competitionRoutes.js';
import { adminRoutes } from './admin/index.js';

export const apiRoutes = Router();

apiRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/goals', goalRoutes);
apiRoutes.use('/collectibles', collectibleRoutes);
apiRoutes.use('/trades', tradeRoutes);
apiRoutes.use('/competitions', competitionRoutes);
apiRoutes.use('/admin', adminRoutes);
