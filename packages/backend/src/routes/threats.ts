import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const threatRouter = Router();

// Create a threat
threatRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, description, strideCategory, severity, threatModelId, componentId, dataFlowId, mitigationNotes } = req.body;

  const threat = await prisma.threat.create({
    data: {
      title,
      description,
      strideCategory,
      severity: severity || 'MEDIUM',
      threatModelId,
      ...(componentId && { componentId }),
      ...(dataFlowId && { dataFlowId }),
      ...(mitigationNotes && { mitigationNotes }),
      aiGenerated: false,
    },
    include: {
      component: { select: { id: true, name: true, type: true } },
      dataFlow: { select: { id: true, label: true } },
    },
  });

  res.status(201).json({ data: threat });
}));

// List threats (with optional filters)
threatRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { threatModelId, strideCategory, severity, status, componentId } = req.query;

  const threats = await prisma.threat.findMany({
    where: {
      ...(threatModelId && { threatModelId: threatModelId as string }),
      ...(componentId && { componentId: componentId as string }),
      ...(strideCategory && { strideCategory: strideCategory as any }),
      ...(severity && { severity: severity as any }),
      ...(status && { status: status as any }),
    },
    include: {
      component: { select: { id: true, name: true, type: true, diagramId: true } },
      dataFlow: { select: { id: true, label: true } },
      _count: { select: { comments: true } },
    },
  });

  // Custom severity order (CRITICAL first)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  res.json({ data: threats });
}));

// Get a single threat
threatRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const threat = await prisma.threat.findUnique({
    where: { id: req.params.id as string },
    include: {
      component: true,
      dataFlow: true,
      comments: {
        where: { parentId: null },
        include: {
          replies: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!threat) {
    res.status(404).json({ error: 'Threat not found' });
    return;
  }
  res.json({ data: threat });
}));

// Update a threat (status, mitigation notes, severity)
threatRouter.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { status, mitigationNotes, severity, title, description } = req.body;

  const threat = await prisma.threat.update({
    where: { id: req.params.id as string },
    data: {
      ...(status && { status }),
      ...(mitigationNotes !== undefined && { mitigationNotes }),
      ...(severity && { severity }),
      ...(title && { title }),
      ...(description && { description }),
    },
  });

  res.json({ data: threat });
}));

// Delete a threat
threatRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.threat.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
}));
