import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { processUploadedCode } from '../services/codeIngestion.js';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
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
uploadRouter.post('/:threatModelId/upload', (req: Request, res: Response) => {
  upload.single('code')(req, res, async (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      res.status(400).json({ error: err.message || 'Upload failed' });
      return;
    }

    const threatModelId = req.params.threatModelId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Send a .zip file with field name "code".' });
      return;
    }

    try {
      console.log(`Processing upload for model ${threatModelId}: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      const result = await processUploadedCode(threatModelId, file.path);
      await fs.unlink(file.path).catch(() => {});
      res.json({ data: result });
    } catch (err: any) {
      console.error('Processing error:', err);
      await fs.unlink(file.path).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });
});
