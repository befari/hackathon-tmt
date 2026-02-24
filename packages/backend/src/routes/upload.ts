import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { processUploadedCode } from '../services/codeIngestion.js';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are supported'));
    }
  },
});

export const uploadRouter = Router();

// Upload source code for a threat model
uploadRouter.post('/:threatModelId/upload', upload.single('code'), async (req: Request, res: Response) => {
  const threatModelId = req.params.threatModelId as string;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const result = await processUploadedCode(threatModelId, file.path);
    // Clean up uploaded file
    await fs.unlink(file.path).catch(() => {});
    res.json({ data: result });
  } catch (err: any) {
    await fs.unlink(file.path).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});
