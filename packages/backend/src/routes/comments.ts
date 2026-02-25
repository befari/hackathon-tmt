import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const commentRouter = Router();

// Get comments for a target (threat, component, or data flow)
commentRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { threatId, componentId, dataFlowId, reviewId } = req.query;

  const comments = await prisma.comment.findMany({
    where: {
      parentId: null, // Only top-level comments
      ...(threatId && { threatId: threatId as string }),
      ...(componentId && { componentId: componentId as string }),
      ...(dataFlowId && { dataFlowId: dataFlowId as string }),
      ...(reviewId && { reviewId: reviewId as string }),
    },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: comments });
}));

// Create a comment
commentRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { body, author, threatId, componentId, dataFlowId, parentId, reviewId } = req.body;

  const comment = await prisma.comment.create({
    data: {
      body,
      author,
      threatId,
      componentId,
      dataFlowId,
      parentId,
      reviewId,
    },
    include: { replies: true },
  });

  res.status(201).json({ data: comment });
}));

// Update a comment
commentRouter.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { body, resolved } = req.body;

  const comment = await prisma.comment.update({
    where: { id: req.params.id as string },
    data: {
      ...(body && { body }),
      ...(resolved !== undefined && { resolved }),
    },
  });

  res.json({ data: comment });
}));

// Get comment counts grouped by target for a threat model
commentRouter.get('/counts', asyncHandler(async (req: Request, res: Response) => {
  const { threatModelId } = req.query;
  if (!threatModelId) {
    res.status(400).json({ error: 'threatModelId is required' });
    return;
  }

  const [componentCounts, threatCounts, flowCounts] = await Promise.all([
    prisma.comment.groupBy({
      by: ['componentId'],
      where: { componentId: { not: null }, component: { diagram: { threatModelId: threatModelId as string } } },
      _count: true,
    }),
    prisma.comment.groupBy({
      by: ['threatId'],
      where: { threatId: { not: null }, threat: { threatModelId: threatModelId as string } },
      _count: true,
    }),
    prisma.comment.groupBy({
      by: ['dataFlowId'],
      where: { dataFlowId: { not: null }, dataFlow: { diagram: { threatModelId: threatModelId as string } } },
      _count: true,
    }),
  ]);

  const toMap = <T extends Record<string, any>>(rows: T[], key: keyof T) =>
    Object.fromEntries(rows.map((r) => [r[key] as string, r._count]));

  res.json({
    data: {
      componentCounts: toMap(componentCounts, 'componentId'),
      threatCounts: toMap(threatCounts, 'threatId'),
      flowCounts: toMap(flowCounts, 'dataFlowId'),
    },
  });
}));

// Delete a comment
commentRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.comment.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
}));
