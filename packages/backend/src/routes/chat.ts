import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';

export const chatRouter = Router();

// Get chat history for a threat model
chatRouter.get('/:threatModelId', async (req: Request, res: Response) => {
  const messages = await prisma.chatMessage.findMany({
    where: { threatModelId: req.params.threatModelId },
    orderBy: { timestamp: 'asc' },
  });

  res.json({ data: messages });
});

// Send a message (placeholder — AI integration comes in Day 2)
chatRouter.post('/:threatModelId', async (req: Request, res: Response) => {
  const { message } = req.body;
  const { threatModelId } = req.params;

  // Save user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      role: 'user',
      content: message,
      threatModelId,
    },
  });

  // TODO: AI response generation with RAG context
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      role: 'assistant',
      content: 'AI integration coming soon. This is a placeholder response.',
      threatModelId,
    },
  });

  res.json({ data: { userMessage, assistantMessage } });
});
