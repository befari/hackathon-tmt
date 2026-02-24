import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';

export const threatModelRouter = Router();

// List all threat models
threatModelRouter.get('/', async (_req: Request, res: Response) => {
  const models = await prisma.threatModel.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { components: true, threats: true, reviews: true },
      },
    },
  });
  res.json({ data: models });
});

// Get a single threat model with all relations
threatModelRouter.get('/:id', async (req: Request, res: Response) => {
  const model = await prisma.threatModel.findUnique({
    where: { id: req.params.id as string },
    include: {
      components: true,
      dataFlows: true,
      threats: {
        include: {
          comments: {
            where: { parentId: null },
            include: { replies: true },
          },
        },
      },
      reviews: true,
    },
  });

  if (!model) {
    res.status(404).json({ error: 'Threat model not found' });
    return;
  }
  res.json({ data: model });
});

// Create a new threat model
threatModelRouter.post('/', async (req: Request, res: Response) => {
  const { name, description, repoUrl } = req.body;

  const model = await prisma.threatModel.create({
    data: { name, description, repoUrl },
  });

  res.status(201).json({ data: model });
});

// Update a threat model
threatModelRouter.patch('/:id', async (req: Request, res: Response) => {
  const { name, description, status } = req.body;

  const model = await prisma.threatModel.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
    },
  });

  res.json({ data: model });
});

// Delete a threat model
threatModelRouter.delete('/:id', async (req: Request, res: Response) => {
  await prisma.threatModel.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
});

// Get components for a threat model
threatModelRouter.get('/:id/components', async (req: Request, res: Response) => {
  const components = await prisma.component.findMany({
    where: { threatModelId: req.params.id as string },
    include: {
      outgoingFlows: true,
      incomingFlows: true,
    },
  });
  res.json({ data: components });
});

// Add a component to a threat model
threatModelRouter.post('/:id/components', async (req: Request, res: Response) => {
  const { name, type, description, sourceFiles, positionX, positionY, metadata } = req.body;

  const component = await prisma.component.create({
    data: {
      name,
      type,
      description,
      sourceFiles: sourceFiles || [],
      positionX: positionX || 0,
      positionY: positionY || 0,
      metadata,
      threatModelId: req.params.id as string,
    },
  });

  res.status(201).json({ data: component });
});

// Get data flows for a threat model
threatModelRouter.get('/:id/data-flows', async (req: Request, res: Response) => {
  const flows = await prisma.dataFlow.findMany({
    where: { threatModelId: req.params.id as string },
    include: { source: true, target: true },
  });
  res.json({ data: flows });
});

// Add a data flow to a threat model
threatModelRouter.post('/:id/data-flows', async (req: Request, res: Response) => {
  const { label, protocol, dataClassification, crossesTrustBoundary, sourceId, targetId, metadata } = req.body;

  const flow = await prisma.dataFlow.create({
    data: {
      label,
      protocol,
      dataClassification,
      crossesTrustBoundary: crossesTrustBoundary || false,
      sourceId,
      targetId,
      metadata,
      threatModelId: req.params.id as string,
    },
  });

  res.status(201).json({ data: flow });
});
