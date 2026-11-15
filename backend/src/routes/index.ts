import { Router } from 'express';

export const apiRouter = Router();

// Health/ping check inside /api/v1
apiRouter.get('/ping', (_req, res) => {
  res.status(200).json({
    success: true,
    data: 'pong',
    error: null,
  });
});