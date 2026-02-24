import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';

export const reviewRouter = Router();

// List reviews for a threat model
reviewRouter.get('/', async (req: Request, res: Response) => {
  const { threatModelId } = req.query;

  const reviews = await prisma.review.findMany({
    where: {
      ...(threatModelId && { threatModelId: threatModelId as string }),
    },
    include: {
      _count: { select: { comments: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  res.json({ data: reviews });
});

// Get a single review with comments
reviewRouter.get('/:id', async (req: Request, res: Response) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: {
      comments: {
        where: { parentId: null },
        include: {
          replies: { orderBy: { createdAt: 'asc' } },
          threat: { select: { id: true, title: true } },
          component: { select: { id: true, name: true } },
          dataFlow: { select: { id: true, label: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!review) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  res.json({ data: review });
});

// Create a review
reviewRouter.post('/', async (req: Request, res: Response) => {
  const { name, reviewerName, threatModelId } = req.body;

  const review = await prisma.review.create({
    data: { name, reviewerName, threatModelId },
  });

  res.status(201).json({ data: review });
});

// Update a review (complete, cancel)
reviewRouter.patch('/:id', async (req: Request, res: Response) => {
  const { status, reviewerName } = req.body;

  const review = await prisma.review.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(reviewerName && { reviewerName }),
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
    },
  });

  res.json({ data: review });
});
