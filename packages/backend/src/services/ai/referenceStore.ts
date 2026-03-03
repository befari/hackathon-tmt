import { PrismaClient } from '@prisma/client';
import type { Tm7ParseResult, Tm7Diagram, Tm7Threat } from '../tm7/types.js';

const prisma = new PrismaClient();

/**
 * Store a parsed .tm7 as a reference example for AI prompt enhancement.
 */
export async function storeReferenceExample(
  name: string,
  parsed: Tm7ParseResult,
  sourceFile?: string
): Promise<string> {
  const ref = await prisma.referenceExample.create({
    data: {
      name,
      description: parsed.metadata.description || null,
      parsedData: JSON.parse(JSON.stringify(parsed)),
      sourceFile: sourceFile || null,
    },
  });
  return ref.id;
}

/**
 * Get the best reference examples for few-shot prompting.
 * Prefers higher-rated examples and limits to maxExamples.
 */
export async function getBestReferenceExamples(maxExamples = 2): Promise<any[]> {
  const examples = await prisma.referenceExample.findMany({
    orderBy: [
      { avgRating: { sort: 'desc', nulls: 'last' } },
      { usageCount: 'asc' }, // Prefer less-used examples for variety
      { createdAt: 'desc' },
    ],
    take: maxExamples,
  });

  // Increment usage count
  if (examples.length > 0) {
    await prisma.referenceExample.updateMany({
      where: { id: { in: examples.map((e) => e.id) } },
      data: { usageCount: { increment: 1 } },
    });
  }

  return examples;
}

/**
 * Format reference examples into a few-shot prompt section.
 * Selects the most relevant diagrams to include (not the entire model).
 */
export function formatFewShotPrompt(examples: any[]): string {
  if (examples.length === 0) return '';

  const sections: string[] = [
    '\n\nREFERENCE EXAMPLES (follow this structure and level of detail):',
  ];

  for (const example of examples) {
    const parsed = example.parsedData as Tm7ParseResult;
    if (!parsed.diagrams || parsed.diagrams.length === 0) continue;

    sections.push(`\n--- Example: ${example.name} ---`);

    // Pick up to 3 representative diagrams (not the huge overview ones)
    const goodDiagrams = selectRepresentativeDiagrams(parsed.diagrams, 3);

    for (const diagram of goodDiagrams) {
      sections.push(formatDiagramExample(diagram));
    }

    // Include a sample of threats to show expected threat style
    const sampleThreats = selectRepresentativeThreats(parsed.threats, 5);
    if (sampleThreats.length > 0) {
      sections.push('\nExample threats for this system:');
      for (const t of sampleThreats) {
        sections.push(
          `  [${t.category}] ${t.title}\n` +
          `    Description: ${truncate(t.description, 200)}\n` +
          `    Mitigation: ${truncate(t.stateInformation, 150)}`
        );
      }
    }
  }

  sections.push('\n--- End of reference examples ---\n');
  return sections.join('\n');
}

/**
 * Format a single diagram as a few-shot example.
 */
function formatDiagramExample(diagram: Tm7Diagram): string {
  const lines: string[] = [`\nDiagram: "${diagram.name}"`];

  // Group elements by type
  const byType: Record<string, string[]> = {};
  const nameMap = new Map<string, string>();

  for (const elem of diagram.elements) {
    const type = elem.type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(elem.name);
    nameMap.set(elem.guid, elem.name);
  }

  lines.push('Components:');
  for (const [type, names] of Object.entries(byType)) {
    // Truncate long names (some .tm7 elements have descriptions as names)
    const shortNames = names.map((n) => n.length > 50 ? n.substring(0, 50) + '…' : n);
    lines.push(`  ${type}: ${shortNames.join(', ')}`);
  }

  if (diagram.flows.length > 0) {
    lines.push('Data Flows:');
    for (const flow of diagram.flows) {
      const src = nameMap.get(flow.sourceGuid) || '?';
      const tgt = nameMap.get(flow.targetGuid) || '?';
      if (src === '?' && tgt === '?') continue;
      lines.push(`  ${src} → ${tgt}: "${flow.label}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Select representative diagrams — prefer ones with 5-15 elements
 * (detailed enough to be useful, not too large to be noisy).
 */
function selectRepresentativeDiagrams(
  diagrams: Tm7Diagram[],
  maxCount: number
): Tm7Diagram[] {
  // Filter out empty diagrams and sort by ideal size range
  const candidates = diagrams
    .filter((d) => d.elements.length >= 3 && d.flows.length >= 2)
    .sort((a, b) => {
      // Prefer 5-15 elements (sweet spot for examples)
      const scoreA = Math.abs(a.elements.length - 10);
      const scoreB = Math.abs(b.elements.length - 10);
      return scoreA - scoreB;
    });

  return candidates.slice(0, maxCount);
}

/**
 * Select representative threats — one per STRIDE category when possible.
 */
function selectRepresentativeThreats(
  threats: Tm7Threat[],
  maxCount: number
): Tm7Threat[] {
  const byCategory = new Map<string, Tm7Threat>();
  const extras: Tm7Threat[] = [];

  for (const t of threats) {
    if (!t.title) continue;
    if (!byCategory.has(t.category)) {
      byCategory.set(t.category, t);
    } else {
      extras.push(t);
    }
  }

  const result = [...byCategory.values()];
  // Fill remaining slots with extras
  for (const t of extras) {
    if (result.length >= maxCount) break;
    result.push(t);
  }

  return result.slice(0, maxCount);
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  // Clean XML entities and excessive whitespace
  const clean = text
    .replace(/&#x[0-9A-Fa-f]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > maxLen ? clean.substring(0, maxLen) + '…' : clean;
}

// ─── AI Generation Tracking ────────────────────────────

/**
 * Record an AI generation for feedback tracking.
 */
export async function recordAIGeneration(
  threatModelId: string,
  aiOutput: any,
  promptContext?: any
): Promise<string> {
  const gen = await prisma.aIGeneration.create({
    data: {
      threatModelId,
      aiOutput: JSON.parse(JSON.stringify(aiOutput)),
      promptContext: promptContext ? JSON.parse(JSON.stringify(promptContext)) : null,
    },
  });
  return gen.id;
}

/**
 * Submit feedback for an AI generation.
 */
export async function submitAIFeedback(
  generationId: string,
  rating: number,
  comment?: string
): Promise<void> {
  await prisma.aIFeedback.create({
    data: {
      generationId,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: comment || null,
    },
  });

  // Update reference example ratings if this generation used them
  // (This is a simplification — in production you'd track which refs were used)
}
