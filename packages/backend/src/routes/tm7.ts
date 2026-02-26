import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { readFile, unlink } from 'fs/promises';
import { PrismaClient, StrideCategory, Severity, ThreatStatus } from '@prisma/client';
import { parseTm7 } from '../services/tm7/index.js';
import type { Tm7StrideCategory, Tm7ThreatState } from '../services/tm7/types.js';
import {
  storeReferenceExample,
  getBestReferenceExamples,
  submitAIFeedback,
} from '../services/ai/referenceStore.js';

import { tmpdir } from 'os';
import { join } from 'path';

const prisma = new PrismaClient();

const upload = multer({
  dest: join(tmpdir(), 'superior-tmt-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.tm7')) {
      cb(null, true);
    } else {
      cb(new Error('Only .tm7 files are supported'));
    }
  },
});

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const tm7Router = Router();

/**
 * POST /api/tm7/import
 * Upload a .tm7 file and create a full ThreatModel from it.
 *
 * Body (multipart/form-data):
 *   - file: the .tm7 file
 *   - contributeAsReference: "true" to also save as AI training reference
 */
tm7Router.post('/import', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload failed' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No .tm7 file provided' });
      return;
    }

    const filePath = req.file.path;

    try {
      const xmlContent = await readFile(filePath, 'utf-8');
      const parsed = parseTm7(xmlContent);

      // Create the full threat model in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the ThreatModel
        const modelName = parsed.diagrams.length > 0
          ? `Imported: ${parsed.diagrams[0].name}`
          : `Imported TM7 (${new Date().toISOString().split('T')[0]})`;

        const threatModel = await tx.threatModel.create({
          data: {
            name: req.file!.originalname.replace('.tm7', ''),
            description: parsed.metadata.description || `Imported from ${req.file!.originalname}`,
            status: 'READY',
          },
        });

        // Add creator as OWNER if authenticated
        const user = (req as any).user;
        if (user?.oid && user.oid !== 'dev-user') {
          const dbUser = await tx.user.findUnique({ where: { entraId: user.oid } });
          if (dbUser) {
            await tx.threatModelMember.create({
              data: {
                role: 'OWNER',
                userId: dbUser.id,
                threatModelId: threatModel.id,
              },
            });
          }
        }

        // 2. Create diagrams, elements, and flows
        // Track old GUID → new DB ID for flow source/target and threat linking
        const guidToComponentId = new Map<string, string>();
        const guidToDiagramId = new Map<string, string>();

        for (let i = 0; i < parsed.diagrams.length; i++) {
          const d = parsed.diagrams[i];

          const diagram = await tx.diagram.create({
            data: {
              name: d.name,
              description: '',
              order: i,
              threatModelId: threatModel.id,
            },
          });

          guidToDiagramId.set(d.guid, diagram.id);

          // Create components from elements
          for (const elem of d.elements) {
            const component = await tx.component.create({
              data: {
                name: elem.name,
                type: elem.type, // Already matches our enum
                description: elem.description || formatDescription(elem),
                sourceFiles: [],
                positionX: elem.position.x,
                positionY: elem.position.y,
                diagramId: diagram.id,
              },
            });
            guidToComponentId.set(elem.guid, component.id);
          }

          // Create data flows
          for (const flow of d.flows) {
            const sourceId = guidToComponentId.get(flow.sourceGuid);
            const targetId = guidToComponentId.get(flow.targetGuid);

            // Skip flows that reference elements not in this diagram
            // (e.g., trust boundary-to-boundary flows)
            if (!sourceId || !targetId) continue;

            await tx.dataFlow.create({
              data: {
                label: flow.label || 'Data Flow',
                protocol: flow.properties['Protocol'] || '',
                dataClassification: flow.properties['Data Classification'] || '',
                crossesTrustBoundary: false,
                sourceId,
                targetId,
                diagramId: diagram.id,
              },
            });
          }
        }

        // 3. Create threats
        for (const threat of parsed.threats) {
          const componentId = guidToComponentId.get(threat.sourceGuid) || null;
          const diagramGuid = threat.diagramGuid;

          await tx.threat.create({
            data: {
              title: threat.title,
              description: threat.description,
              strideCategory: mapStrideCategory(threat.category),
              severity: mapPriority(threat.priority),
              status: mapThreatState(threat.state),
              mitigationNotes: threat.stateInformation || null,
              aiGenerated: false,
              confidence: null,
              threatModelId: threatModel.id,
              componentId,
            },
          });
        }

        // Get full model with counts
        const fullModel = await tx.threatModel.findUnique({
          where: { id: threatModel.id },
          include: {
            diagrams: {
              include: {
                _count: { select: { components: true, dataFlows: true } },
              },
            },
            _count: { select: { threats: true } },
          },
        });

        return fullModel;
      });

      // Opt-in: store as reference example for AI training
      const contributeAsReference = req.body?.contributeAsReference === 'true';
      let referenceId: string | undefined;
      if (contributeAsReference) {
        try {
          referenceId = await storeReferenceExample(
            req.file!.originalname.replace('.tm7', ''),
            parsed,
            req.file!.originalname
          );
        } catch (refErr) {
          console.warn('Could not store reference example:', refErr);
        }
      }

      res.status(201).json({
        message: 'TM7 file imported successfully',
        threatModel: result,
        referenceId,
        stats: {
          diagrams: parsed.diagrams.length,
          elements: parsed.diagrams.reduce((s, d) => s + d.elements.length, 0),
          flows: parsed.diagrams.reduce((s, d) => s + d.flows.length, 0),
          threats: parsed.threats.length,
        },
      });
    } catch (parseErr: any) {
      console.error('TM7 import error:', parseErr);
      res.status(400).json({ error: `Failed to parse .tm7 file: ${parseErr.message}` });
    } finally {
      // Clean up uploaded file
      try { await unlink(filePath); } catch {}
    }
  });
});

/**
 * GET /api/tm7/references
 * List all reference examples.
 */
tm7Router.get('/references', asyncHandler(async (_req: Request, res: Response) => {
  const refs = await prisma.referenceExample.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      sourceFile: true,
      avgRating: true,
      usageCount: true,
      createdAt: true,
    },
  });
  res.json(refs);
}));

/**
 * DELETE /api/tm7/references/:id
 * Remove a reference example.
 */
tm7Router.delete('/references/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.referenceExample.delete({ where: { id: req.params.id as string } });
  res.status(204).end();
}));

/**
 * POST /api/tm7/feedback
 * Submit feedback for an AI generation.
 * Body: { generationId, rating (1-5), comment? }
 */
tm7Router.post('/feedback', asyncHandler(async (req: Request, res: Response) => {
  const { generationId, rating, comment } = req.body;
  if (!generationId || !rating) {
    res.status(400).json({ error: 'generationId and rating are required' });
    return;
  }
  await submitAIFeedback(generationId, rating, comment);
  res.json({ message: 'Feedback submitted' });
}));

// ─── Mapping helpers ────────────────────────────────────

function mapStrideCategory(cat: Tm7StrideCategory): StrideCategory {
  const map: Record<string, StrideCategory> = {
    'Spoofing': 'SPOOFING',
    'Tampering': 'TAMPERING',
    'Repudiation': 'REPUDIATION',
    'Information Disclosure': 'INFO_DISCLOSURE',
    'Denial of Service': 'DENIAL_OF_SERVICE',
    'Elevation of Privilege': 'ELEVATION_OF_PRIVILEGE',
  };
  return map[cat] || 'SPOOFING';
}

function mapPriority(priority: string): Severity {
  const lower = priority.toLowerCase();
  if (lower === 'critical') return 'CRITICAL';
  if (lower === 'high') return 'HIGH';
  if (lower === 'medium') return 'MEDIUM';
  if (lower === 'low') return 'LOW';
  return 'MEDIUM';
}

function mapThreatState(state: Tm7ThreatState): ThreatStatus {
  const map: Record<string, ThreatStatus> = {
    'Mitigated': 'MITIGATED',
    'NotApplicable': 'OUT_OF_SCOPE',
    'NeedsInvestigation': 'OPEN',
    'NotStarted': 'OPEN',
  };
  return map[state] || 'OPEN';
}

/** Build a description from element properties for elements without explicit descriptions */
function formatDescription(elem: { name: string; outOfScope: boolean; outOfScopeReason: string; properties: Record<string, string> }): string {
  const parts: string[] = [];
  if (elem.outOfScope) {
    parts.push(`[Out of Scope${elem.outOfScopeReason ? ': ' + elem.outOfScopeReason : ''}]`);
  }
  // Include non-trivial custom properties in the description
  for (const [key, val] of Object.entries(elem.properties)) {
    if (val && val !== 'No' && val !== 'false' && !key.includes('Header')) {
      parts.push(`${key}: ${val}`);
    }
  }
  return parts.join('\n');
}
