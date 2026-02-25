import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

app.listen(PORT, () => {
  console.log(`🛡️  Superior TMT backend running on http://localhost:${PORT}`);
});
