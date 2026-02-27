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
  const { name, description, status, m1Owner, devOwners, assumptions, externalDependencies } = req.body;

  const model = await prisma.threatModel.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
      ...(m1Owner !== undefined && { m1Owner }),
      ...(devOwners !== undefined && { devOwners }),
      ...(assumptions !== undefined && { assumptions }),
      ...(externalDependencies !== undefined && { externalDependencies }),
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

// Auto-generate STRIDE threats for existing DFD
threatModelRouter.post('/:id/generate-threats', asyncHandler(async (req, res) => {
  const tmId = req.params.id as string;
  const { diagramId } = req.body;

  // Load the threat model with its diagrams, components, and flows
  const model = await prisma.threatModel.findUnique({
    where: { id: tmId },
    include: {
      diagrams: {
        include: {
          components: true,
          dataFlows: true,
        },
      },
    },
  });

  if (!model) {
    res.status(404).json({ error: 'Threat model not found' });
    return;
  }

  const targetDiagrams = diagramId
    ? model.diagrams.filter((d) => d.id === diagramId)
    : model.diagrams;

  if (targetDiagrams.length === 0) {
    res.status(400).json({ error: 'No diagrams found to analyze' });
    return;
  }

  // Build DFD description for the AI
  const dfdDescription = targetDiagrams.map((diagram) => {
    const components = diagram.components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description || '',
    }));

    const flows = diagram.dataFlows.map((f) => {
      const src = diagram.components.find((c) => c.id === f.sourceId);
      const tgt = diagram.components.find((c) => c.id === f.targetId);
      return {
        id: f.id,
        label: f.label,
        source: src?.name || f.sourceId,
        target: tgt?.name || f.targetId,
        crossesTrustBoundary: f.crossesTrustBoundary,
        protocol: (f.metadata as any)?.protocol || '',
      };
    });

    return {
      diagramName: diagram.name,
      components,
      dataFlows: flows,
    };
  });

  // Initialize AI client
  const { getOpenAIClient } = await import('../services/ai/orchestrator.js');
  const { getBestReferenceExamples, formatFewShotPrompt } = await import('../services/ai/referenceStore.js');
  let client: any;
  try {
    client = getOpenAIClient();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
    return;
  }

  // Load reference examples from imported .tm7 files for few-shot prompting
  const refExamples = await getBestReferenceExamples(2);
  const fewShotSection = formatFewShotPrompt(refExamples);

  // Build the component/flow ID maps for linking
  const allComponents = targetDiagrams.flatMap((d) => d.components);
  const allFlows = targetDiagrams.flatMap((d) => d.dataFlows);

  const buildMessages = (includeFewShot: boolean) => [
    {
      role: 'system' as const,
      content: `You are a professional security architect performing a risk assessment using the STRIDE methodology on a software system's Data Flow Diagram (DFD). Your goal is to identify potential security risks and recommend mitigations.

Output ONLY valid JSON matching this schema:
{
  "threats": [
    {
      "title": "Short risk title",
      "description": "Detailed description of the security risk, its potential impact, and recommended mitigation controls",
      "strideCategory": "SPOOFING | TAMPERING | REPUDIATION | INFO_DISCLOSURE | DENIAL_OF_SERVICE | ELEVATION_OF_PRIVILEGE",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
      "confidence": 0.85,
      "linkedComponentId": "actual-component-uuid-from-DFD",
      "linkedDataFlowId": "actual-flow-uuid-from-DFD"
    }
  ]
}

Guidelines:
- Identify security risks for each component and data flow in the DFD
- Prioritize data flows crossing trust boundaries (typically higher severity)
- Evaluate: authentication controls, authorization policies, input validation, data protection, audit logging, error handling
- Reference actual component and flow names for specificity
- Use the exact component/flow IDs provided in the DFD for linkedComponentId/linkedDataFlowId
- A risk should link to EITHER a component OR a data flow, not both
- Assign severity based on potential business impact and likelihood
- Confidence score (0-1) reflects assessment certainty
- Cover all applicable STRIDE categories
- Include recommended security controls in the description${includeFewShot ? fewShotSection : ''}`,
    },
    {
      role: 'user' as const,
      content: `Perform a STRIDE security risk assessment for the system: "${model.name}"

${model.description ? `System description: ${model.description}\n` : ''}
Data Flow Diagram:
${JSON.stringify(dfdDescription, null, 2)}`,
    },
  ];

  let content: string | null = null;

  // Try with few-shot examples first; retry without if content filter triggers
  for (const includeFewShot of [true, false]) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        messages: buildMessages(includeFewShot),
        temperature: 0.3,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });
      content = response.choices[0]?.message?.content;
      break;
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const isContentFilter = status === 400 && (
        err?.message?.includes('content management policy') ||
        err?.message?.includes('content_filter') ||
        JSON.stringify(err).includes('content_filter')
      );
      if (isContentFilter && includeFewShot) {
        console.warn('Content filter triggered with reference examples, retrying without them...');
        continue;
      }
      throw err;
    }
  }

  if (!content) {
    res.status(500).json({ error: 'AI returned empty response' });
    return;
  }

  const validCategories = new Set([
    'SPOOFING', 'TAMPERING', 'REPUDIATION',
    'INFO_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
  ]);
  const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
  const componentIds = new Set(allComponents.map((c) => c.id));
  const flowIds = new Set(allFlows.map((f) => f.id));

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    res.status(500).json({ error: 'Failed to parse AI response' });
    return;
  }

  const threats = (parsed.threats || [])
    .filter((t: any) => t.title && t.description)
    .map((t: any) => ({
      title: t.title,
      description: t.description,
      strideCategory: validCategories.has(t.strideCategory) ? t.strideCategory : 'INFO_DISCLOSURE',
      severity: validSeverities.has(t.severity) ? t.severity : 'MEDIUM',
      confidence: typeof t.confidence === 'number' ? Math.min(1, Math.max(0, t.confidence)) : 0.5,
      componentId: t.linkedComponentId && componentIds.has(t.linkedComponentId) ? t.linkedComponentId : undefined,
      dataFlowId: t.linkedDataFlowId && flowIds.has(t.linkedDataFlowId) ? t.linkedDataFlowId : undefined,
    }));

  // Save threats to DB
  let created = 0;
  const maxNum = await prisma.threat.aggregate({
    where: { threatModelId: tmId },
    _max: { number: true },
  });
  let nextNum = (maxNum._max.number || 0) + 1;
  for (const threat of threats) {
    await prisma.threat.create({
      data: {
        number: nextNum++,
        title: threat.title,
        description: threat.description,
        strideCategory: threat.strideCategory,
        severity: threat.severity,
        status: 'OPEN',
        aiGenerated: true,
        confidence: threat.confidence,
        threatModelId: tmId,
        componentId: threat.componentId,
        dataFlowId: threat.dataFlowId,
      },
    });
    created++;
  }

  // Record the AI generation for feedback tracking
  const { recordAIGeneration } = await import('../services/ai/referenceStore.js');
  const generationId = await recordAIGeneration(tmId, parsed, {
    type: 'threat-generation',
    dfdDescription,
    threatsGenerated: created,
  });

  res.json({
    data: {
      threatsGenerated: created,
      message: `Generated ${created} STRIDE threats`,
      generationId,
    },
  });
}));
