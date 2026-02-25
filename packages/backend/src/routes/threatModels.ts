import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';

export const threatModelRouter = Router();

// Wrap async route handlers so Express 4 catches errors
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// List threat models the user has access to
threatModelRouter.get('/', asyncHandler(async (req, res) => {
  const user = req.user;

  // In dev mode (no auth), show all
  if (!user || user.oid === 'dev-user') {
    const models = await prisma.threatModel.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { diagrams: true, threats: true, reviews: true } } },
    });
    res.json({ data: models });
    return;
  }

  // Find user's DB record
  const dbUser = await prisma.user.findUnique({ where: { entraId: user.oid } });
  if (!dbUser) {
    res.json({ data: [] });
    return;
  }

  const models = await prisma.threatModel.findMany({
    where: { members: { some: { userId: dbUser.id } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { diagrams: true, threats: true, reviews: true } },
      members: {
        where: { userId: dbUser.id },
        select: { role: true },
      },
    },
  });
  res.json({ data: models });
}));

// Create a new threat model (auto-add creator as OWNER)
threatModelRouter.post('/', asyncHandler(async (req, res) => {
  const { name, description, repoUrl } = req.body;
  const user = req.user;

  const model = await prisma.threatModel.create({
    data: { name, description, repoUrl },
  });

  // Auto-add creator as owner if authenticated
  if (user && user.oid !== 'dev-user') {
    const dbUser = await prisma.user.upsert({
      where: { entraId: user.oid },
      update: { email: user.email, name: user.name },
      create: { entraId: user.oid, email: user.email, name: user.name },
    });
    await prisma.threatModelMember.create({
      data: { userId: dbUser.id, threatModelId: model.id, role: 'OWNER' },
    });
  }

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

// --- Members & Sharing ---

// List members of a threat model
threatModelRouter.get('/:id/members', asyncHandler(async (req, res) => {
  const members = await prisma.threatModelMember.findMany({
    where: { threatModelId: req.params.id as string },
    include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: members });
}));

// Add a member by email
threatModelRouter.post('/:id/members', asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const threatModelId = req.params.id as string;

  // Find or create a placeholder user by email
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { entraId: `pending-${email}`, email, name: email.split('@')[0] },
    });
  }

  const member = await prisma.threatModelMember.upsert({
    where: { userId_threatModelId: { userId: user.id, threatModelId } },
    update: { role },
    create: { userId: user.id, threatModelId, role },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  res.status(201).json({ data: member });
}));

// Update a member's role
threatModelRouter.patch('/:id/members/:memberId', asyncHandler(async (req, res) => {
  const { role } = req.body;
  const member = await prisma.threatModelMember.update({
    where: { id: req.params.memberId as string },
    data: { role },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  res.json({ data: member });
}));

// Remove a member
threatModelRouter.delete('/:id/members/:memberId', asyncHandler(async (req, res) => {
  await prisma.threatModelMember.delete({ where: { id: req.params.memberId as string } });
  res.status(204).send();
}));

// Create a share link
threatModelRouter.post('/:id/share-links', asyncHandler(async (req, res) => {
  const { role, expiresAt } = req.body;
  const link = await prisma.shareLink.create({
    data: {
      threatModelId: req.params.id as string,
      role: role || 'VIEWER',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
  });
  res.status(201).json({ data: link });
}));

// List share links
threatModelRouter.get('/:id/share-links', asyncHandler(async (req, res) => {
  const links = await prisma.shareLink.findMany({
    where: { threatModelId: req.params.id as string },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: links });
}));

// Deactivate a share link
threatModelRouter.delete('/:id/share-links/:linkId', asyncHandler(async (req, res) => {
  await prisma.shareLink.update({
    where: { id: req.params.linkId as string },
    data: { active: false },
  });
  res.status(204).send();
}));
