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

// Get chat history for a threat model
chatRouter.get('/:threatModelId', asyncHandler(async (req: Request, res: Response) => {
  const messages = await prisma.chatMessage.findMany({
    where: { threatModelId: req.params.threatModelId as string },
    orderBy: { timestamp: 'asc' },
  });

  res.json({ data: messages });
}));

// Send a message with AI response
chatRouter.post('/:threatModelId', asyncHandler(async (req: Request, res: Response) => {
  const { message, mentions } = req.body;
  const { threatModelId } = req.params as { threatModelId: string };

  // Save user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      role: 'user',
      content: message,
      threatModelId,
    },
  });

  // Get chat history for context
  const history = await prisma.chatMessage.findMany({
    where: { threatModelId },
    orderBy: { timestamp: 'asc' },
    take: 20,
  });

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
    data: {
      role: 'assistant',
      content: aiResponse,
      threatModelId,
    },
  });

  res.json({ data: { userMessage, assistantMessage } });
}));
