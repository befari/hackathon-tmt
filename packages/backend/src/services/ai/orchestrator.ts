import { OpenAI } from 'openai';
import prisma from '../../prisma/client.js';
import { generateDfd } from './dfdGenerator.js';
import { generateThreats } from './threatGenerator.js';

// Initialize Azure OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;

  if (!apiKey || !endpoint) {
    throw new Error(
      'Azure OpenAI not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables.'
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'}`,
    defaultQuery: { 'api-version': '2024-10-21' },
    defaultHeaders: { 'api-key': apiKey },
  });
}

export { getOpenAIClient };

interface CodeFile {
  path: string;
  content: string;
}

interface AnalysisResult {
  diagramsCreated: number;
  componentsCreated: number;
  flowsCreated: number;
  threatsCreated: number;
  generationId?: string | null;
}

export async function analyzeCodebase(
  threatModelId: string,
  files: CodeFile[]
): Promise<AnalysisResult> {
  const client = getOpenAIClient();

  // Step 1: Generate file summaries
  console.log('Step 1: Summarizing codebase...');
  const summaries = await summarizeFiles(client, files);

  // Step 2: Generate DFDs (one per scenario)
  console.log('Step 2: Generating DFDs...');
  const dfd = await generateDfd(client, summaries, files, threatModelId);

  // Step 3: Save diagrams, components, and data flows to database
  console.log('Step 3: Saving to database...');
  const componentMap = new Map<string, string>(); // temp_id -> db_id
  let totalComponents = 0;
  let flowsCreated = 0;

  for (let i = 0; i < dfd.diagrams.length; i++) {
    const diagramDef = dfd.diagrams[i];

    const diagram = await prisma.diagram.create({
      data: {
        name: diagramDef.name,
        description: diagramDef.description,
        order: i,
        threatModelId,
      },
    });

    for (const comp of diagramDef.components) {
      const created = await prisma.component.create({
        data: {
          name: comp.name,
          type: comp.type,
          description: comp.description,
          sourceFiles: comp.sourceFiles || [],
          positionX: comp.positionX || 0,
          positionY: comp.positionY || 0,
          diagramId: diagram.id,
        },
      });
      componentMap.set(comp.tempId, created.id);
    }
    totalComponents += diagramDef.components.length;

    for (const flow of diagramDef.dataFlows) {
      const sourceId = componentMap.get(flow.sourceTempId);
      const targetId = componentMap.get(flow.targetTempId);
      if (!sourceId || !targetId) continue;

      await prisma.dataFlow.create({
        data: {
          label: flow.label,
          protocol: flow.protocol,
          dataClassification: flow.dataClassification,
          crossesTrustBoundary: flow.crossesTrustBoundary || false,
          sourceId,
          targetId,
          diagramId: diagram.id,
        },
      });
      flowsCreated++;
    }
  }

  // Step 4: Generate threats
  console.log('Step 4: Generating threats...');
  const threats = await generateThreats(client, dfd, summaries);

  let threatsCreated = 0;
  for (const threat of threats) {
    const componentId = threat.componentTempId ? componentMap.get(threat.componentTempId) : null;

    await prisma.threat.create({
      data: {
        title: threat.title,
        description: threat.description,
        strideCategory: threat.strideCategory,
        severity: threat.severity,
        status: 'OPEN',
        aiGenerated: true,
        confidence: threat.confidence,
        threatModelId,
        componentId: componentId || undefined,
      },
    });
    threatsCreated++;
  }

  console.log(
    `Analysis complete: ${dfd.diagrams.length} diagrams, ${totalComponents} components, ${flowsCreated} flows, ${threatsCreated} threats`
  );

  return {
    diagramsCreated: dfd.diagrams.length,
    componentsCreated: totalComponents,
    flowsCreated,
    threatsCreated,
    generationId: (dfd as any)._generationId || null,
  };
}

async function summarizeFiles(
  client: OpenAI,
  files: CodeFile[]
): Promise<string> {
  // Create a condensed view of the codebase
  const fileList = files
    .map((f) => {
      // For large files, just include the first 100 lines
      const lines = f.content.split('\n');
      const preview = lines.slice(0, 100).join('\n');
      const truncated = lines.length > 100 ? `\n... (${lines.length - 100} more lines)` : '';
      return `--- ${f.path} ---\n${preview}${truncated}`;
    })
    .join('\n\n');

  // If total is too large, summarize in batches
  const maxChars = 80000;
  const truncatedFileList =
    fileList.length > maxChars
      ? fileList.substring(0, maxChars) + '\n\n... (truncated, additional files not shown)'
      : fileList;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert software architect analyzing a codebase for threat modeling purposes. 
Provide a comprehensive architectural summary that identifies:
1. All distinct services, components, and modules
2. Data stores (databases, caches, file systems, message queues)
3. External dependencies and APIs
4. Authentication/authorization mechanisms
5. Network boundaries and trust zones
6. Data flows between components
7. Sensitive data handling

Be thorough but concise. Focus on security-relevant architectural details.`,
      },
      {
        role: 'user',
        content: `Analyze this codebase and provide an architectural summary:\n\n${truncatedFileList}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || 'Unable to generate summary';
}
