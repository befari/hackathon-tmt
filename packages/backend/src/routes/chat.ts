import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';
import { chatWithContext } from '../services/ai/embeddings.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const chatRouter = Router();

// Get mentionable items (threats + diagrams) for @ autocomplete
chatRouter.get('/:threatModelId/mentions', asyncHandler(async (req: Request, res: Response) => {
  const { threatModelId } = req.params as { threatModelId: string };

  const [threats, diagrams] = await Promise.all([
    prisma.threat.findMany({
      where: { threatModelId },
      select: { id: true, number: true, title: true, strideCategory: true, severity: true },
      orderBy: { number: 'asc' },
    }),
    prisma.diagram.findMany({
      where: { threatModelId },
      select: { id: true, name: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  res.json({
    data: [
      ...threats.map((t) => ({
        type: 'threat' as const,
        id: t.id,
        label: `T-${t.number}: ${t.title}`,
        detail: `${t.strideCategory} / ${t.severity}`,
      })),
      ...diagrams.map((d) => ({
        type: 'diagram' as const,
        id: d.id,
        label: `DFD: ${d.name}`,
        detail: 'Diagram',
      })),
    ],
  });
}));

// --- Chat Sessions ---

// List sessions for a threat model
chatRouter.get('/:threatModelId/sessions', asyncHandler(async (req: Request, res: Response) => {
  const sessions = await prisma.chatSession.findMany({
    where: { threatModelId: req.params.threatModelId as string },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });
  res.json({ data: sessions });
}));

// Create a new session
chatRouter.post('/:threatModelId/sessions', asyncHandler(async (req: Request, res: Response) => {
  const { title } = req.body;
  const session = await prisma.chatSession.create({
    data: {
      title: title || 'New Chat',
      threatModelId: req.params.threatModelId as string,
    },
  });
  res.status(201).json({ data: session });
}));

// Rename a session
chatRouter.patch('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { title } = req.body;
  const session = await prisma.chatSession.update({
    where: { id: req.params.sessionId as string },
    data: { title },
  });
  res.json({ data: session });
}));

// Delete a session (and its messages)
chatRouter.delete('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  await prisma.chatSession.delete({ where: { id: req.params.sessionId as string } });
  res.json({ data: { success: true } });
}));

// --- Messages (scoped to session) ---

// Get messages for a session
chatRouter.get('/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response) => {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: req.params.sessionId as string },
    orderBy: { timestamp: 'asc' },
  });
  res.json({ data: messages });
}));

// Send a message in a session
chatRouter.post('/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { message, mentions } = req.body;
  const { sessionId } = req.params as { sessionId: string };

  // Get the session to find threatModelId
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const { threatModelId } = session;

  // Save user message
  const userMessage = await prisma.chatMessage.create({
    data: { role: 'user', content: message, threatModelId, sessionId },
  });

  // Get session chat history for context
  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
    take: 20,
  });

  // Auto-title: if this is the first message, set session title from the message
  const msgCount = await prisma.chatMessage.count({ where: { sessionId, role: 'user' } });
  if (msgCount === 1) {
    const autoTitle = message.length > 50 ? message.slice(0, 47) + '...' : message;
    await prisma.chatSession.update({ where: { id: sessionId }, data: { title: autoTitle } });
  }

  let aiResponse: string;
  try {
    aiResponse = await chatWithContext(
      threatModelId,
      message,
      history.map((m) => ({ role: m.role, content: m.content })),
      mentions
    );
  } catch (err: any) {
    console.error('AI chat error:', err.message);
    aiResponse = `I'm unable to connect to the AI service right now. Error: ${err.message}`;
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: { role: 'assistant', content: aiResponse, threatModelId, sessionId },
  });

  // Touch session updatedAt
  await prisma.chatSession.update({ where: { id: sessionId }, data: {} });

  res.json({ data: { userMessage, assistantMessage } });
}));

// --- Legacy: flat message list (for backwards compat) ---

// Get all chat history for a threat model (across all sessions)
chatRouter.get('/:threatModelId', asyncHandler(async (req: Request, res: Response) => {
  const messages = await prisma.chatMessage.findMany({
    where: { threatModelId: req.params.threatModelId as string },
    orderBy: { timestamp: 'asc' },
  });
  res.json({ data: messages });
}));
