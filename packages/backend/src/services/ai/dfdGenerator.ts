import { OpenAI } from 'openai';

interface DfdComponent {
  tempId: string;
  name: string;
  type: 'PROCESS' | 'DATA_STORE' | 'EXTERNAL_ENTITY' | 'TRUST_BOUNDARY';
  description: string;
  sourceFiles: string[];
  positionX: number;
  positionY: number;
}

interface DfdDataFlow {
  sourceTempId: string;
  targetTempId: string;
  label: string;
  protocol?: string;
  dataClassification?: string;
  crossesTrustBoundary?: boolean;
}

export interface DfdDiagram {
  name: string;
  description?: string;
  components: DfdComponent[];
  dataFlows: DfdDataFlow[];
}

export interface DfdResult {
  diagrams: DfdDiagram[];
}

export async function generateDfd(
  client: OpenAI,
  codebaseSummary: string,
  files: { path: string; content: string }[]
): Promise<DfdResult> {
  // Build a file tree for context
  const fileTree = files.map((f) => f.path).join('\n');

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert threat modeling architect. Generate Data Flow Diagrams (DFDs) from the codebase analysis.
Identify distinct scenarios or subsystems and create a separate diagram for each one.

Output ONLY valid JSON matching this schema:
{
  "diagrams": [
    {
      "name": "Scenario Name",
      "description": "What this diagram covers",
      "components": [
        {
          "tempId": "comp-1",
          "name": "Component Name",
          "type": "PROCESS | DATA_STORE | EXTERNAL_ENTITY | TRUST_BOUNDARY",
          "description": "What this component does",
          "sourceFiles": ["path/to/file.ts"],
          "positionX": 0,
          "positionY": 0
        }
      ],
      "dataFlows": [
        {
          "sourceTempId": "comp-1",
          "targetTempId": "comp-2",
          "label": "HTTP API calls",
          "protocol": "HTTPS",
          "dataClassification": "confidential",
          "crossesTrustBoundary": true
        }
      ]
    }
  ]
}

Rules:
- Create one diagram per distinct scenario (e.g., "Authentication", "Data Processing", "User Management")
- Use meaningful component names that reflect their actual purpose
- Component types: PROCESS (services, APIs, workers), DATA_STORE (databases, caches, file storage), EXTERNAL_ENTITY (external APIs, users, third-party services), TRUST_BOUNDARY (network/security zones)
- Position components logically: external entities on edges, processes in the middle, data stores near their consumers
- Use reasonable x,y coordinates (0-800 range) for a clean layout with spacing
- Data classification: "public", "internal", "confidential", "restricted"
- Mark flows that cross trust boundaries
- Include all significant data flows, including authentication, logging, and monitoring
- Every component must have at least one data flow connection
- Each diagram should be self-contained with its own components and flows`,
      },
      {
        role: 'user',
        content: `Generate DFDs for this codebase:

ARCHITECTURAL SUMMARY:
${codebaseSummary}

FILE TREE:
${fileTree}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned empty DFD response');
  }

  try {
    const parsed = JSON.parse(content) as DfdResult;

    // Validate the response
    if (!parsed.diagrams || !Array.isArray(parsed.diagrams)) {
      throw new Error('Invalid DFD: missing diagrams array');
    }

    const validTypes = new Set(['PROCESS', 'DATA_STORE', 'EXTERNAL_ENTITY', 'TRUST_BOUNDARY']);
    for (const diagram of parsed.diagrams) {
      if (!diagram.components || !Array.isArray(diagram.components)) {
        diagram.components = [];
      }
      if (!diagram.dataFlows || !Array.isArray(diagram.dataFlows)) {
        diagram.dataFlows = [];
      }
      for (const comp of diagram.components) {
        if (!validTypes.has(comp.type)) {
          comp.type = 'PROCESS';
        }
      }
    }

    return parsed;
  } catch (err: any) {
    console.error('Failed to parse DFD JSON:', content);
    throw new Error(`Failed to parse AI DFD response: ${err.message}`);
  }
}
