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

// Tool definitions for OpenAI function calling
const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'update_threat',
      description: 'Update a threat\'s fields such as mitigation notes, status, severity, title, or description. Use the threat number (e.g. 1 for T-1) to identify the threat.',
      parameters: {
        type: 'object',
        properties: {
          threatNumber: { type: 'number', description: 'The threat number (e.g. 1 for T-1, 2 for T-2)' },
          mitigationNotes: { type: 'string', description: 'Updated mitigation notes/strategy' },
          status: { type: 'string', enum: ['OPEN', 'MITIGATED', 'ACCEPTED', 'OUT_OF_SCOPE'], description: 'Updated threat status' },
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'], description: 'Updated severity level' },
          title: { type: 'string', description: 'Updated threat title' },
          description: { type: 'string', description: 'Updated threat description' },
        },
        required: ['threatNumber'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_component',
      description: 'Update a DFD component\'s description.',
      parameters: {
        type: 'object',
        properties: {
          componentName: { type: 'string', description: 'The name of the component to update' },
          description: { type: 'string', description: 'Updated component description' },
        },
        required: ['componentName'],
      },
    },
  },
];

// Execute a tool call and return the result
async function executeTool(
  threatModelId: string,
  name: string,
  args: Record<string, any>
): Promise<string> {
  if (name === 'update_threat') {
    const threat = await prisma.threat.findFirst({
      where: { threatModelId, number: args.threatNumber },
    });
    if (!threat) return `Error: Threat T-${args.threatNumber} not found.`;

    const updateData: Record<string, any> = {};
    if (args.mitigationNotes !== undefined) updateData.mitigationNotes = args.mitigationNotes;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.severity !== undefined) updateData.severity = args.severity;
    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined) updateData.description = args.description;

    if (Object.keys(updateData).length === 0) return 'No fields to update were provided.';

    const updated = await prisma.threat.update({
      where: { id: threat.id },
      data: updateData,
    });
    const fields = Object.keys(updateData).join(', ');
    return `Successfully updated T-${args.threatNumber} (${fields}). Current state: title="${updated.title}", status=${updated.status}, severity=${updated.severity}, mitigation="${updated.mitigationNotes || 'none'}"`;
  }

  if (name === 'update_component') {
    const component = await prisma.component.findFirst({
      where: {
        diagram: { threatModelId },
        name: { equals: args.componentName, mode: 'insensitive' },
      },
    });
    if (!component) return `Error: Component "${args.componentName}" not found.`;

    const updateData: Record<string, any> = {};
    if (args.description !== undefined) updateData.description = args.description;

    if (Object.keys(updateData).length === 0) return 'No fields to update were provided.';

    await prisma.component.update({
      where: { id: component.id },
      data: updateData,
    });
    return `Successfully updated component "${args.componentName}".`;
  }

  return `Unknown tool: ${name}`;
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

When the user references threats by number (e.g. T-1, T-2), use the threat inventory above to identify the correct threat. Help the user understand the architecture, threats, and security posture. Be specific and reference actual components and data flows when possible. If you don't know something, say so rather than guessing.

You have tools available to UPDATE threats and components. When the user asks you to update, edit, or change a threat's mitigation notes, status, severity, title, or description, use the update_threat tool. When asked to update a component's description, use update_component. Always confirm what you changed after making updates.`,
    },
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  // Tool-calling loop: let the model call tools and feed results back
  let response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    messages,
    tools: chatTools,
    temperature: 0.5,
    max_tokens: 2000,
  });

  let choice = response.choices[0];
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls && iterations < MAX_ITERATIONS) {
    iterations++;
    messages.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeTool(threatModelId, toolCall.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages,
      tools: chatTools,
      temperature: 0.5,
      max_tokens: 2000,
    });
    choice = response.choices[0];
  }

  return choice?.message?.content || 'I was unable to generate a response.';
}
