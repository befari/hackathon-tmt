import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);

  // Prisma "not found" errors
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  res.status(500).json({
    error: err.message || 'Internal server error',
  });
}
