import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './prisma/client.js';
import { threatModelRouter } from './routes/threatModels.js';
import { threatRouter } from './routes/threats.js';
import { commentRouter } from './routes/comments.js';
import { reviewRouter } from './routes/reviews.js';
import { chatRouter } from './routes/chat.js';
import { uploadRouter } from './routes/upload.js';
import { tm7Router } from './routes/tm7.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Log unhandled promise rejections but don't crash
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Wait for database to be ready before starting
async function waitForDb(retries = 10, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
      return;
    } catch {
      console.log(`⏳ Waiting for database... (attempt ${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after ' + retries + ' attempts');
}

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (login/me, no auth required on some)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/threat-models', requireAuth, threatModelRouter);
app.use('/api/threats', requireAuth, threatRouter);
app.use('/api/comments', requireAuth, commentRouter);
app.use('/api/reviews', requireAuth, reviewRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/upload', requireAuth, uploadRouter);
app.use('/api/tm7', requireAuth, tm7Router);

// Error handler
app.use(errorHandler);

waitForDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🛡️  Superior TMT backend running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});
