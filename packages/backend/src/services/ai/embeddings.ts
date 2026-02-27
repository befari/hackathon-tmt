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
      name: 'create_diagram',
      description: 'Create a new DFD diagram in the threat model.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the diagram' },
          description: { type: 'string', description: 'Description of what the diagram represents' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_component',
      description: 'Create a new DFD component (process, data store, external entity, or trust boundary) in a diagram.',
      parameters: {
        type: 'object',
        properties: {
          diagramName: { type: 'string', description: 'Name of the diagram to add the component to' },
          name: { type: 'string', description: 'Name for the component' },
          type: { type: 'string', enum: ['PROCESS', 'DATA_STORE', 'EXTERNAL_ENTITY', 'TRUST_BOUNDARY'], description: 'Component type' },
          description: { type: 'string', description: 'Description of the component' },
          positionX: { type: 'number', description: 'X position on canvas (default: auto-layout)' },
          positionY: { type: 'number', description: 'Y position on canvas (default: auto-layout)' },
        },
        required: ['diagramName', 'name', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_component',
      description: 'Update an existing DFD component\'s name, description, or type.',
      parameters: {
        type: 'object',
        properties: {
          componentName: { type: 'string', description: 'Current name of the component to update' },
          name: { type: 'string', description: 'New name for the component' },
          description: { type: 'string', description: 'Updated component description' },
          type: { type: 'string', enum: ['PROCESS', 'DATA_STORE', 'EXTERNAL_ENTITY', 'TRUST_BOUNDARY'], description: 'Updated component type' },
        },
        required: ['componentName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_component',
      description: 'Delete a DFD component by name.',
      parameters: {
        type: 'object',
        properties: {
          componentName: { type: 'string', description: 'Name of the component to delete' },
        },
        required: ['componentName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_data_flow',
      description: 'Create a data flow (connection) between two components in a diagram.',
      parameters: {
        type: 'object',
        properties: {
          diagramName: { type: 'string', description: 'Name of the diagram containing both components' },
          sourceName: { type: 'string', description: 'Name of the source component' },
          targetName: { type: 'string', description: 'Name of the target component' },
          label: { type: 'string', description: 'Label for the data flow (e.g. "HTTP Request", "SQL Query")' },
          protocol: { type: 'string', description: 'Protocol used (e.g. "HTTPS", "TCP", "gRPC")' },
          dataClassification: { type: 'string', description: 'Classification of data (e.g. "Confidential", "Public")' },
          crossesTrustBoundary: { type: 'boolean', description: 'Whether the flow crosses a trust boundary' },
        },
        required: ['diagramName', 'sourceName', 'targetName', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_data_flow',
      description: 'Update an existing data flow\'s properties.',
      parameters: {
        type: 'object',
        properties: {
          flowLabel: { type: 'string', description: 'Current label of the data flow to update' },
          label: { type: 'string', description: 'New label for the data flow' },
          protocol: { type: 'string', description: 'Updated protocol' },
          dataClassification: { type: 'string', description: 'Updated data classification' },
          crossesTrustBoundary: { type: 'boolean', description: 'Whether the flow crosses a trust boundary' },
        },
        required: ['flowLabel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_data_flow',
      description: 'Delete a data flow by its label.',
      parameters: {
        type: 'object',
        properties: {
          flowLabel: { type: 'string', description: 'Label of the data flow to delete' },
        },
        required: ['flowLabel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_threat',
      description: 'Create a new threat in the threat model. Use this when the user asks you to identify, generate, or add threats.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title for the threat' },
          description: { type: 'string', description: 'Detailed description of the threat, how it could be exploited, and its impact' },
          strideCategory: { type: 'string', enum: ['SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFO_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE'], description: 'STRIDE category' },
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'], description: 'Severity level' },
          mitigationNotes: { type: 'string', description: 'Suggested mitigations or countermeasures' },
          componentName: { type: 'string', description: 'Name of the DFD component this threat applies to (optional)' },
          dataFlowLabel: { type: 'string', description: 'Label of the data flow this threat applies to (optional)' },
        },
        required: ['title', 'description', 'strideCategory', 'severity'],
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

  if (name === 'create_diagram') {
    const existing = await prisma.diagram.count({ where: { threatModelId } });
    const diagram = await prisma.diagram.create({
      data: {
        name: args.name,
        description: args.description || '',
        order: existing,
        threatModelId,
      },
    });
    return `Created diagram "${diagram.name}" (id: ${diagram.id}).`;
  }

  if (name === 'create_component') {
    const diagram = await prisma.diagram.findFirst({
      where: { threatModelId, name: { equals: args.diagramName, mode: 'insensitive' } },
    });
    if (!diagram) return `Error: Diagram "${args.diagramName}" not found.`;

    // Auto-layout: spread components in a grid if no position given
    const count = await prisma.component.count({ where: { diagramId: diagram.id } });
    const col = count % 4;
    const row = Math.floor(count / 4);
    const posX = args.positionX ?? 100 + col * 250;
    const posY = args.positionY ?? 100 + row * 200;

    const component = await prisma.component.create({
      data: {
        name: args.name,
        type: args.type,
        description: args.description || '',
        positionX: posX,
        positionY: posY,
        diagramId: diagram.id,
      },
    });
    return `Created ${args.type} "${component.name}" in diagram "${args.diagramName}" at (${posX}, ${posY}).`;
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
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.type !== undefined) updateData.type = args.type;

    if (Object.keys(updateData).length === 0) return 'No fields to update were provided.';

    await prisma.component.update({
      where: { id: component.id },
      data: updateData,
    });
    return `Successfully updated component "${args.componentName}".`;
  }

  if (name === 'delete_component') {
    const component = await prisma.component.findFirst({
      where: {
        diagram: { threatModelId },
        name: { equals: args.componentName, mode: 'insensitive' },
      },
    });
    if (!component) return `Error: Component "${args.componentName}" not found.`;

    await prisma.component.delete({ where: { id: component.id } });
    return `Deleted component "${args.componentName}".`;
  }

  if (name === 'create_data_flow') {
    const diagram = await prisma.diagram.findFirst({
      where: { threatModelId, name: { equals: args.diagramName, mode: 'insensitive' } },
      include: { components: true },
    });
    if (!diagram) return `Error: Diagram "${args.diagramName}" not found.`;

    const source = diagram.components.find(
      (c) => c.name.toLowerCase() === args.sourceName.toLowerCase()
    );
    const target = diagram.components.find(
      (c) => c.name.toLowerCase() === args.targetName.toLowerCase()
    );
    if (!source) return `Error: Source component "${args.sourceName}" not found in diagram "${args.diagramName}".`;
    if (!target) return `Error: Target component "${args.targetName}" not found in diagram "${args.diagramName}".`;

    const flow = await prisma.dataFlow.create({
      data: {
        label: args.label,
        protocol: args.protocol || null,
        dataClassification: args.dataClassification || null,
        crossesTrustBoundary: args.crossesTrustBoundary ?? false,
        sourceId: source.id,
        targetId: target.id,
        diagramId: diagram.id,
      },
    });
    return `Created data flow "${flow.label}" from "${args.sourceName}" to "${args.targetName}".`;
  }

  if (name === 'update_data_flow') {
    const flow = await prisma.dataFlow.findFirst({
      where: {
        diagram: { threatModelId },
        label: { equals: args.flowLabel, mode: 'insensitive' },
      },
    });
    if (!flow) return `Error: Data flow "${args.flowLabel}" not found.`;

    const updateData: Record<string, any> = {};
    if (args.label !== undefined) updateData.label = args.label;
    if (args.protocol !== undefined) updateData.protocol = args.protocol;
    if (args.dataClassification !== undefined) updateData.dataClassification = args.dataClassification;
    if (args.crossesTrustBoundary !== undefined) updateData.crossesTrustBoundary = args.crossesTrustBoundary;

    if (Object.keys(updateData).length === 0) return 'No fields to update were provided.';

    await prisma.dataFlow.update({ where: { id: flow.id }, data: updateData });
    return `Successfully updated data flow "${args.flowLabel}".`;
  }

  if (name === 'delete_data_flow') {
    const flow = await prisma.dataFlow.findFirst({
      where: {
        diagram: { threatModelId },
        label: { equals: args.flowLabel, mode: 'insensitive' },
      },
    });
    if (!flow) return `Error: Data flow "${args.flowLabel}" not found.`;

    await prisma.dataFlow.delete({ where: { id: flow.id } });
    return `Deleted data flow "${args.flowLabel}".`;
  }

  if (name === 'create_threat') {
    // Get next threat number
    const max = await prisma.threat.aggregate({
      where: { threatModelId },
      _max: { number: true },
    });
    const nextNumber = (max._max.number || 0) + 1;

    // Optionally link to component or data flow
    let componentId: string | undefined;
    let dataFlowId: string | undefined;

    if (args.componentName) {
      const comp = await prisma.component.findFirst({
        where: { diagram: { threatModelId }, name: { equals: args.componentName, mode: 'insensitive' } },
      });
      if (comp) componentId = comp.id;
    }
    if (args.dataFlowLabel) {
      const flow = await prisma.dataFlow.findFirst({
        where: { diagram: { threatModelId }, label: { equals: args.dataFlowLabel, mode: 'insensitive' } },
      });
      if (flow) dataFlowId = flow.id;
    }

    const threat = await prisma.threat.create({
      data: {
        number: nextNumber,
        title: args.title,
        description: args.description,
        strideCategory: args.strideCategory,
        severity: args.severity,
        status: 'OPEN',
        mitigationNotes: args.mitigationNotes || null,
        aiGenerated: true,
        threatModelId,
        componentId: componentId || null,
        dataFlowId: dataFlowId || null,
      },
    });
    return `Created T-${nextNumber}: "${threat.title}" [${args.strideCategory}/${args.severity}]${componentId ? ' linked to component' : ''}${dataFlowId ? ' linked to data flow' : ''}`;
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

  // Get threat model with diagrams, threats, comments, and reviews
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
        select: {
          id: true, number: true, title: true, description: true, strideCategory: true,
          severity: true, status: true, mitigationNotes: true, componentId: true, dataFlowId: true,
          comments: {
            where: { parentId: null },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, author: true, body: true, createdAt: true,
              replies: { select: { author: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
      reviews: {
        orderBy: { startedAt: 'desc' },
        select: {
          id: true, name: true, status: true, startedAt: true,
          comments: {
            where: { parentId: null },
            orderBy: { createdAt: 'asc' },
            select: {
              author: true, body: true, createdAt: true,
              threat: { select: { number: true, title: true } },
              replies: { select: { author: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
    },
  });

  // Build threat summary with comments (always included)
  const threatSummary = (model?.threats || []).map((t: any) => {
    let line = `T-${t.number}: ${t.title} [${t.strideCategory}/${t.severity}/${t.status}]`;
    if (t.comments?.length) {
      const commentLines = t.comments.map((c: any) => {
        let thread = `    💬 ${c.author}: ${c.body}`;
        if (c.replies?.length) {
          thread += c.replies.map((r: any) => `\n      ↳ ${r.author}: ${r.body}`).join('');
        }
        return thread;
      }).join('\n');
      line += `\n  Comments:\n${commentLines}`;
    }
    return line;
  }).join('\n');

  // Build DFD summary (always included)
  const dfdSummary = (model?.diagrams || []).map((d: any) => {
    const comps = d.components.map((c: any) => `  - ${c.type}: ${c.name}`).join('\n');
    const flows = d.dataFlows.map((f: any) => {
      const src = d.components.find((c: any) => c.id === f.sourceId)?.name || f.sourceId;
      const tgt = d.components.find((c: any) => c.id === f.targetId)?.name || f.targetId;
      return `  - ${src} → ${tgt} (${f.label}${f.protocol ? ', ' + f.protocol : ''})`;
    }).join('\n');
    return `Diagram: ${d.name}\nComponents:\n${comps || '  (none)'}\nData Flows:\n${flows || '  (none)'}`;
  }).join('\n\n');

  // Build security review summary (always included)
  const reviewSummary = (model?.reviews || []).map((r: any) => {
    let line = `Review: "${r.name}" [${r.status}] (${new Date(r.startedAt).toLocaleDateString()})`;
    if (r.comments?.length) {
      const commentLines = r.comments.map((c: any) => {
        const threatRef = c.threat ? ` (re: T-${c.threat.number}: ${c.threat.title})` : '';
        let thread = `    💬 ${c.author}${threatRef}: ${c.body}`;
        if (c.replies?.length) {
          thread += c.replies.map((rep: any) => `\n      ↳ ${rep.author}: ${rep.body}`).join('');
        }
        return thread;
      }).join('\n');
      line += `\n  Comments:\n${commentLines}`;
    }
    return line;
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

SECURITY REVIEWS:
${reviewSummary || '(No reviews yet)'}
${mentionContext}

When the user references threats by number (e.g. T-1, T-2), use the threat inventory above to identify the correct threat. Help the user understand the architecture, threats, and security posture. Be specific and reference actual components and data flows when possible. If you don't know something, say so rather than guessing.

You have tools to CREATE and MODIFY the threat model:
- create_threat: Generate a new threat with STRIDE category, severity, description, and optional mitigations. Can link to a specific component or data flow.
- update_threat: Change a threat's mitigation, status, severity, title, or description by T-number
- create_diagram: Create a new DFD diagram
- create_component: Add a process, data store, external entity, or trust boundary to a diagram
- update_component: Rename or update a component's description/type
- delete_component: Remove a component from a diagram
- create_data_flow: Add a data flow connection between two components
- update_data_flow: Change a data flow's label, protocol, classification, or trust boundary crossing
- delete_data_flow: Remove a data flow

When the user asks you to identify, generate, or add threats, use create_threat. You can create multiple threats in one response. When generating threats, analyze the DFD architecture to identify realistic threats based on STRIDE methodology. Always confirm what you created or changed after making updates.`,
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
