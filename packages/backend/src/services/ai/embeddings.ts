import { OpenAI } from 'openai';
import prisma from '../../prisma/client.js';
import { getOpenAIClient } from './orchestrator.js';

// Simple embedding-based RAG for chat context
// For MVP, we use file content search instead of full vector embedding pipeline
// This can be upgraded to pgvector embeddings post-MVP

interface CodeChunk {
  filePath: string;
  content: string;
  relevanceScore: number;
}

export async function findRelevantCode(
  threatModelId: string,
  query: string
): Promise<CodeChunk[]> {
  // For MVP: search through component source files and descriptions
  const components = await prisma.component.findMany({
    where: { diagram: { threatModelId } },
    select: { name: true, description: true, sourceFiles: true },
  });

  const threats = await prisma.threat.findMany({
    where: { threatModelId },
    select: { title: true, description: true },
  });

  // Build context from existing data
  const context: CodeChunk[] = [
    ...components.map((c) => ({
      filePath: `component:${c.name}`,
      content: `Component: ${c.name}\nDescription: ${c.description || 'N/A'}\nSource files: ${c.sourceFiles.join(', ')}`,
      relevanceScore: 1,
    })),
    ...threats.map((t) => ({
      filePath: `threat:${t.title}`,
      content: `Threat: ${t.title}\n${t.description}`,
      relevanceScore: 0.8,
    })),
  ];

  return context;
}

export async function chatWithContext(
  threatModelId: string,
  userMessage: string,
  chatHistory: { role: string; content: string }[]
): Promise<string> {
  const client = getOpenAIClient();

  // Get relevant context
  const context = await findRelevantCode(threatModelId, userMessage);
  const contextText = context.map((c) => c.content).join('\n\n');

  // Get threat model info
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: { name: true, description: true },
  });

  const messages: any[] = [
    {
      role: 'system',
      content: `You are a security-focused AI assistant helping with threat modeling for "${model?.name || 'this system'}".
${model?.description ? `System description: ${model.description}` : ''}

You have access to the following context about the system:

${contextText}

Help the user understand the architecture, threats, and security posture. Be specific and reference actual components and data flows when possible. If you don't know something, say so rather than guessing.`,
    },
    // Include recent chat history for context
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    messages,
    temperature: 0.5,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || 'I was unable to generate a response.';
}
