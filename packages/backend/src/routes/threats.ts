import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';

export const threatRouter = Router();

// List threats (with optional filters)
threatRouter.get('/', async (req: Request, res: Response) => {
  const { threatModelId, strideCategory, severity, status } = req.query;

  const threats = await prisma.threat.findMany({
    where: {
      ...(threatModelId && { threatModelId: threatModelId as string }),
      ...(strideCategory && { strideCategory: strideCategory as any }),
      ...(severity && { severity: severity as any }),
      ...(status && { status: status as any }),
    },
    include: {
      component: { select: { id: true, name: true, type: true } },
      dataFlow: { select: { id: true, label: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  });

  // Custom severity order (CRITICAL first)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  res.json({ data: threats });
});

// Get a single threat
threatRouter.get('/:id', async (req: Request, res: Response) => {
  const threat = await prisma.threat.findUnique({
    where: { id: req.params.id },
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
});

// Update a threat (status, mitigation notes, severity)
threatRouter.patch('/:id', async (req: Request, res: Response) => {
  const { status, mitigationNotes, severity, title, description } = req.body;

  const threat = await prisma.threat.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(mitigationNotes !== undefined && { mitigationNotes }),
      ...(severity && { severity }),
      ...(title && { title }),
      ...(description && { description }),
    },
  });

  res.json({ data: threat });
});

// Delete a threat
threatRouter.delete('/:id', async (req: Request, res: Response) => {
  await prisma.threat.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
