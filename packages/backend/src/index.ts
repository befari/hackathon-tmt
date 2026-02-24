import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { threatModelRouter } from './routes/threatModels.js';
import { threatRouter } from './routes/threats.js';
import { commentRouter } from './routes/comments.js';
import { reviewRouter } from './routes/reviews.js';
import { chatRouter } from './routes/chat.js';
import { uploadRouter } from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/threat-models', threatModelRouter);
app.use('/api/threats', threatRouter);
app.use('/api/comments', commentRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/chat', chatRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🛡️  Superior TMT backend running on http://localhost:${PORT}`);
});
