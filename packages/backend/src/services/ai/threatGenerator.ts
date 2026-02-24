import { OpenAI } from 'openai';
import type { DfdResult } from './dfdGenerator.js';

interface GeneratedThreat {
  title: string;
  description: string;
  strideCategory:
    | 'SPOOFING'
    | 'TAMPERING'
    | 'REPUDIATION'
    | 'INFO_DISCLOSURE'
    | 'DENIAL_OF_SERVICE'
    | 'ELEVATION_OF_PRIVILEGE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: number;
  componentTempId?: string;
}

export async function generateThreats(
  client: OpenAI,
  dfd: DfdResult,
  codebaseSummary: string
): Promise<GeneratedThreat[]> {
  const dfdDescription = JSON.stringify(dfd, null, 2);

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert security threat modeler. Analyze the Data Flow Diagram and generate STRIDE threats.

Output ONLY valid JSON matching this schema:
{
  "threats": [
    {
      "title": "Short threat title",
      "description": "Detailed description of the threat, including attack vector, potential impact, and suggested mitigation",
      "strideCategory": "SPOOFING | TAMPERING | REPUDIATION | INFO_DISCLOSURE | DENIAL_OF_SERVICE | ELEVATION_OF_PRIVILEGE",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
      "confidence": 0.85,
      "componentTempId": "comp-1"
    }
  ]
}

STRIDE Categories:
- SPOOFING: Pretending to be something or someone else
- TAMPERING: Modifying data or code without authorization
- REPUDIATION: Claiming to not have performed an action
- INFO_DISCLOSURE: Exposing information to unauthorized users
- DENIAL_OF_SERVICE: Making the system unavailable
- ELEVATION_OF_PRIVILEGE: Gaining unauthorized access to resources

Rules:
- Generate threats for EACH component and data flow
- Focus on data flows that cross trust boundaries (higher severity)
- Consider: authentication, authorization, input validation, encryption, logging, error handling
- Be specific — reference actual components and flows from the DFD
- Assign realistic severity based on potential impact and likelihood
- Confidence score (0-1) reflects how certain you are the threat applies
- Include at least one threat per STRIDE category if applicable
- Include suggested mitigations in the description`,
      },
      {
        role: 'user',
        content: `Generate STRIDE threats for this system:

DFD:
${dfdDescription}

CODEBASE SUMMARY:
${codebaseSummary}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned empty threats response');
  }

  try {
    const parsed = JSON.parse(content);
    const threats = parsed.threats || [];

    // Validate categories and severity
    const validCategories = new Set([
      'SPOOFING', 'TAMPERING', 'REPUDIATION',
      'INFO_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
    ]);
    const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

    return threats
      .filter((t: any) => t.title && t.description)
      .map((t: any) => ({
        title: t.title,
        description: t.description,
        strideCategory: validCategories.has(t.strideCategory)
          ? t.strideCategory
          : 'INFO_DISCLOSURE',
        severity: validSeverities.has(t.severity) ? t.severity : 'MEDIUM',
        confidence: typeof t.confidence === 'number' ? Math.min(1, Math.max(0, t.confidence)) : 0.5,
        componentTempId: t.componentTempId || undefined,
      }));
  } catch (err: any) {
    console.error('Failed to parse threats JSON:', content);
    throw new Error(`Failed to parse AI threats response: ${err.message}`);
  }
}
