import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const reviewRouter = Router();

// List reviews for a threat model
reviewRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
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
}));

// Get a single review with comments
reviewRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const review = await prisma.review.findUnique({
    where: { id: req.params.id as string },
    include: {
      comments: {
        where: { parentId: null },
        include: {
          replies: { orderBy: { createdAt: 'asc' } },
          threat: { select: { id: true, number: true, title: true } },
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
}));

// Create a review
reviewRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, reviewerName, threatModelId } = req.body;

  const review = await prisma.review.create({
    data: { name, reviewerName, threatModelId },
  });

  res.status(201).json({ data: review });
}));

// Update a review (complete, cancel, rename)
reviewRouter.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { status, reviewerName, name } = req.body;

  const review = await prisma.review.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(status && { status }),
      ...(reviewerName && { reviewerName }),
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
    },
  });

  res.json({ data: review });
}));

// Delete a review
reviewRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.comment.deleteMany({ where: { reviewId: req.params.id as string } });
  await prisma.review.delete({ where: { id: req.params.id as string } });
  res.json({ data: { id: req.params.id } });
}));
