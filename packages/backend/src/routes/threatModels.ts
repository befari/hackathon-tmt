import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';

export const threatModelRouter = Router();

// Wrap async route handlers so Express 4 catches errors
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// List all threat models
threatModelRouter.get('/', asyncHandler(async (_req, res) => {
  const models = await prisma.threatModel.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { diagrams: true, threats: true, reviews: true },
      },
    },
  });
  res.json({ data: models });
}));

// Create a new threat model
threatModelRouter.post('/', asyncHandler(async (req, res) => {
  const { name, description, repoUrl } = req.body;

  const model = await prisma.threatModel.create({
    data: { name, description, repoUrl },
  });

  res.status(201).json({ data: model });
}));

// --- Specific-path routes MUST come before /:id catch-all ---

// Update a diagram
threatModelRouter.patch('/diagrams/:diagramId', asyncHandler(async (req, res) => {
  const { name, description, order } = req.body;

  const diagram = await prisma.diagram.update({
    where: { id: req.params.diagramId as string },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
    },
  });

  res.json({ data: diagram });
}));

// Delete a diagram
threatModelRouter.delete('/diagrams/:diagramId', asyncHandler(async (req, res) => {
  await prisma.diagram.delete({ where: { id: req.params.diagramId as string } });
  res.status(204).send();
}));

// Update a component
threatModelRouter.patch('/components/:id', asyncHandler(async (req, res) => {
  const { name, type, description, sourceFiles, positionX, positionY, metadata } = req.body;

  const component = await prisma.component.update({
    where: { id: req.params.id as string },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(description !== undefined && { description }),
      ...(sourceFiles !== undefined && { sourceFiles }),
      ...(positionX !== undefined && { positionX }),
      ...(positionY !== undefined && { positionY }),
      ...(metadata !== undefined && { metadata }),
    },
  });

  res.json({ data: component });
}));

// Delete a component
threatModelRouter.delete('/components/:id', asyncHandler(async (req, res) => {
  await prisma.component.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
}));

// Update a data flow
threatModelRouter.patch('/data-flows/:id', asyncHandler(async (req, res) => {
  const { label, protocol, dataClassification, crossesTrustBoundary, metadata } = req.body;

  const flow = await prisma.dataFlow.update({
    where: { id: req.params.id as string },
    data: {
      ...(label !== undefined && { label }),
      ...(protocol !== undefined && { protocol }),
      ...(dataClassification !== undefined && { dataClassification }),
      ...(crossesTrustBoundary !== undefined && { crossesTrustBoundary }),
      ...(metadata !== undefined && { metadata }),
    },
  });

  res.json({ data: flow });
}));

// Delete a data flow
threatModelRouter.delete('/data-flows/:id', asyncHandler(async (req, res) => {
  await prisma.dataFlow.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
}));

// --- Parameterized /:id routes ---

// Get a single threat model with all relations
threatModelRouter.get('/:id', asyncHandler(async (req, res) => {
  const model = await prisma.threatModel.findUnique({
    where: { id: req.params.id as string },
    include: {
      diagrams: {
        orderBy: { order: 'asc' },
        include: {
          components: true,
          dataFlows: true,
        },
      },
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
}));

// Update a threat model
threatModelRouter.patch('/:id', asyncHandler(async (req, res) => {
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
}));

// Delete a threat model
threatModelRouter.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.threatModel.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
}));

// --- Diagram routes nested under /:id ---

// Create a diagram for a threat model
threatModelRouter.post('/:id/diagrams', asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const diagram = await prisma.diagram.create({
    data: {
      name,
      description,
      threatModelId: req.params.id as string,
    },
  });

  res.status(201).json({ data: diagram });
}));

// List diagrams for a threat model
threatModelRouter.get('/:id/diagrams', asyncHandler(async (req, res) => {
  const diagrams = await prisma.diagram.findMany({
    where: { threatModelId: req.params.id as string },
    orderBy: { order: 'asc' },
  });
  res.json({ data: diagrams });
}));

// Get a diagram with its components and data flows
threatModelRouter.get('/:id/diagrams/:diagramId', asyncHandler(async (req, res) => {
  const diagram = await prisma.diagram.findUnique({
    where: { id: req.params.diagramId as string },
    include: {
      components: {
        include: { outgoingFlows: true, incomingFlows: true },
      },
      dataFlows: {
        include: { source: true, target: true },
      },
    },
  });

  if (!diagram) {
    res.status(404).json({ error: 'Diagram not found' });
    return;
  }
  res.json({ data: diagram });
}));

// Add a component to a diagram
threatModelRouter.post('/:id/diagrams/:diagramId/components', asyncHandler(async (req, res) => {
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
      diagramId: req.params.diagramId as string,
    },
  });

  res.status(201).json({ data: component });
}));

// Add a data flow to a diagram
threatModelRouter.post('/:id/diagrams/:diagramId/data-flows', asyncHandler(async (req, res) => {
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
      diagramId: req.params.diagramId as string,
    },
  });

  res.status(201).json({ data: flow });
}));
