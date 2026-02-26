import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import unzipper from 'unzipper';
import prisma from '../prisma/client.js';
import { analyzeCodebase } from './ai/orchestrator.js';

// File extensions we care about for code analysis
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go',
  '.rs', '.c', '.cpp', '.h', '.hpp', '.rb', '.php', '.swift',
  '.kt', '.scala', '.sh', '.bash', '.yml', '.yaml', '.json',
  '.xml', '.html', '.css', '.scss', '.sql', '.proto', '.graphql',
  '.tf', '.dockerfile', '.toml', '.ini', '.cfg', '.conf',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '__pycache__', '.next', '.nuxt',
  'dist', 'build', 'out', 'target', 'bin', 'obj', '.gradle',
  'vendor', '.venv', 'venv', 'env', '.env', 'coverage',
  '.idea', '.vscode', '.vs',
]);

// Max file size to process (500KB)
const MAX_FILE_SIZE = 500 * 1024;

interface ExtractedFile {
  path: string;
  content: string;
}

export async function processUploadedCode(
  threatModelId: string,
  zipPath: string
): Promise<{ filesProcessed: number; message: string; generationId?: string }> {
  // Update threat model status
  await prisma.threatModel.update({
    where: { id: threatModelId },
    data: { status: 'ANALYZING' },
  });

  try {
    // Extract and filter files from zip
    const files = await extractZip(zipPath);
    console.log(`Extracted ${files.length} code files from zip`);

    if (files.length === 0) {
      throw new Error('No code files found in the uploaded zip');
    }

    // Run AI analysis pipeline
    const result = await analyzeCodebase(threatModelId, files);

    // Update status
    await prisma.threatModel.update({
      where: { id: threatModelId },
      data: { status: 'READY' },
    });

    return {
      filesProcessed: files.length,
      message: `Analyzed ${files.length} files. Generated ${result.componentsCreated} components, ${result.flowsCreated} data flows, and ${result.threatsCreated} threats.`,
      generationId: result.generationId || undefined,
    };
  } catch (err) {
    await prisma.threatModel.update({
      where: { id: threatModelId },
      data: { status: 'DRAFT' },
    });
    throw err;
  }
}

async function extractZip(zipPath: string): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = [];

  const directory = await unzipper.Open.file(zipPath);

  for (const entry of directory.files) {
    // Skip directories
    if (entry.type === 'Directory') continue;

    // Skip hidden files
    const basename = path.basename(entry.path);
    if (basename.startsWith('.')) continue;

    // Skip excluded directories
    const parts = entry.path.split('/');
    if (parts.some((p) => SKIP_DIRS.has(p))) continue;

    // Only include code files
    const ext = path.extname(entry.path).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext)) continue;

    // Skip large files
    if (entry.uncompressedSize > MAX_FILE_SIZE) continue;

    try {
      const buffer = await entry.buffer();
      const content = buffer.toString('utf-8');

      // Skip binary-looking files
      if (content.includes('\0')) continue;

      files.push({
        path: entry.path,
        content,
      });
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return files;
}
