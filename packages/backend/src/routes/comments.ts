import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';

export const commentRouter = Router();

// Get comments for a target (threat, component, or data flow)
commentRouter.get('/', async (req: Request, res: Response) => {
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
});

// Create a comment
commentRouter.post('/', async (req: Request, res: Response) => {
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
});

// Update a comment
commentRouter.patch('/:id', async (req: Request, res: Response) => {
  const { body, resolved } = req.body;

  const comment = await prisma.comment.update({
    where: { id: req.params.id },
    data: {
      ...(body && { body }),
      ...(resolved !== undefined && { resolved }),
    },
  });

  res.json({ data: comment });
});

// Delete a comment
commentRouter.delete('/:id', async (req: Request, res: Response) => {
  await prisma.comment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
