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
  chatHistory: { role: string; content: string }[],
  mentions?: { type: string; id: string }[]
): Promise<string> {
  const client = getOpenAIClient();

  // Get threat model with diagrams and threats
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: {
      name: true,
      description: true,
      diagrams: {
        orderBy: { order: 'asc' },
        include: {
          components: { select: { id: true, name: true, type: true, description: true } },
          dataFlows: { select: { id: true, label: true, protocol: true, dataClassification: true, crossesTrustBoundary: true, sourceId: true, targetId: true } },
        },
      },
      threats: {
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true, description: true, strideCategory: true, severity: true, status: true, mitigationNotes: true, componentId: true, dataFlowId: true },
      },
    },
  });

  // Build threat summary (always included)
  const threatSummary = (model?.threats || []).map((t) =>
    `T-${t.number}: ${t.title} [${t.strideCategory}/${t.severity}/${t.status}]`
  ).join('\n');

  // Build DFD summary (always included)
  const dfdSummary = (model?.diagrams || []).map((d) => {
    const comps = d.components.map((c) => `  - ${c.type}: ${c.name}`).join('\n');
    const flows = d.dataFlows.map((f) => {
      const src = d.components.find((c) => c.id === f.sourceId)?.name || f.sourceId;
      const tgt = d.components.find((c) => c.id === f.targetId)?.name || f.targetId;
      return `  - ${src} → ${tgt} (${f.label}${f.protocol ? ', ' + f.protocol : ''})`;
    }).join('\n');
    return `Diagram: ${d.name}\nComponents:\n${comps || '  (none)'}\nData Flows:\n${flows || '  (none)'}`;
  }).join('\n\n');

  // Build detailed context for @-mentioned items
  let mentionContext = '';
  if (mentions?.length) {
    const mentionParts: string[] = [];
    for (const m of mentions) {
      if (m.type === 'threat') {
        const t = (model?.threats || []).find((t) => t.id === m.id);
        if (t) {
          mentionParts.push(
            `--- Mentioned Threat T-${t.number} ---\nTitle: ${t.title}\nCategory: ${t.strideCategory}\nSeverity: ${t.severity}\nStatus: ${t.status}\nDescription: ${t.description}\nMitigation: ${t.mitigationNotes || 'None documented'}`
          );
        }
      } else if (m.type === 'diagram') {
        const d = (model?.diagrams || []).find((d) => d.id === m.id);
        if (d) {
          const comps = d.components.map((c) => `  - ${c.type}: ${c.name}${c.description ? ' — ' + c.description : ''}`).join('\n');
          const flows = d.dataFlows.map((f) => {
            const src = d.components.find((c) => c.id === f.sourceId)?.name || f.sourceId;
            const tgt = d.components.find((c) => c.id === f.targetId)?.name || f.targetId;
            return `  - ${src} → ${tgt} (${f.label}, protocol: ${f.protocol || 'N/A'}, classification: ${f.dataClassification || 'N/A'}, crosses trust boundary: ${f.crossesTrustBoundary})`;
          }).join('\n');
          mentionParts.push(`--- Mentioned DFD: ${d.name} ---\nComponents:\n${comps}\nData Flows:\n${flows}`);
        }
      }
    }
    if (mentionParts.length) {
      mentionContext = '\n\nThe user explicitly referenced the following items (pay special attention to these):\n\n' + mentionParts.join('\n\n');
    }
  }

  const messages: any[] = [
    {
      role: 'system',
      content: `You are a security-focused AI assistant helping with threat modeling for "${model?.name || 'this system'}".
${model?.description ? `System description: ${model.description}` : ''}

THREAT INVENTORY:
${threatSummary || '(No threats identified yet)'}

DFD ARCHITECTURE:
${dfdSummary || '(No diagrams yet)'}
${mentionContext}

When the user references threats by number (e.g. T-1, T-2), use the threat inventory above to identify the correct threat. Help the user understand the architecture, threats, and security posture. Be specific and reference actual components and data flows when possible. If you don't know something, say so rather than guessing.`,
    },
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
