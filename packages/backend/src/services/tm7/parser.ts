import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import type {
  Tm7ParseResult,
  Tm7Metadata,
  Tm7Diagram,
  Tm7Element,
  Tm7ElementType,
  Tm7Flow,
  Tm7Threat,
  Tm7ThreatTemplate,
  Tm7StrideCategory,
  Tm7ThreatState,
} from './types';

// XML namespace prefixes used in .tm7 files
const NS = {
  model: 'ThreatModeling.Model',
  abs: 'ThreatModeling.Model.Abstracts',
  kb: 'ThreatModeling.KnowledgeBase',
  arr: 'Serialization/Arrays',
};

/**
 * Stencil xsi:type → our element type mapping.
 * These are the xsi:type values on Border Value elements.
 */
const STENCIL_TYPE_MAP: Record<string, Tm7ElementType> = {
  StencilEllipse: 'PROCESS',
  StencilParallelLines: 'DATA_STORE',
  StencilRectangle: 'EXTERNAL_ENTITY',
  BorderBoundary: 'TRUST_BOUNDARY',
  LineBoundary: 'TRUST_BOUNDARY',
};

/**
 * STRIDE category letter → full name
 */
const STRIDE_MAP: Record<string, Tm7StrideCategory> = {
  S: 'Spoofing',
  T: 'Tampering',
  R: 'Repudiation',
  I: 'Information Disclosure',
  D: 'Denial of Service',
  E: 'Elevation of Privilege',
};

/**
 * Parse a .tm7 XML file into a normalized structure.
 *
 * The .tm7 format uses deeply-nested XML with multiple namespaces.
 * fast-xml-parser strips namespaces when removeNSPrefix is true,
 * making traversal manageable.
 */
export function parseTm7(xmlContent: string): Tm7ParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    // Preserve attribute prefix for xsi:type detection
    attributeNamePrefix: '@_',
    // Always parse these as arrays even with single child
    isArray: (name: string) => {
      return [
        'DrawingSurfaceModel',
        'KeyValueOfguidanyType',
        'KeyValueOfstringThreatpc_P0_PhOB',
        'KeyValueOfstringstring',
        'anyType',
        'string',
        'ThreatType',
        'StandardElement',
        'GenericElement',
      ].includes(name);
    },
  });

  const doc = parser.parse(xmlContent);
  const root = doc.ThreatModel;

  if (!root) {
    throw new Error('Invalid .tm7 file: missing ThreatModel root element');
  }

  const metadata = extractMetadata(root);
  const threatTemplates = extractThreatTemplates(root);
  const { diagrams, guidNameMap } = extractDiagrams(root);
  const threats = extractThreats(root, guidNameMap, threatTemplates);

  return { metadata, diagrams, threats, threatTemplates };
}

/**
 * Parse a .tm7 file from disk.
 */
export function parseTm7File(filePath: string): Tm7ParseResult {
  const content = readFileSync(filePath, 'utf-8');
  return parseTm7(content);
}

// ─── Metadata ───────────────────────────────────────────

function extractMetadata(root: any): Tm7Metadata {
  const meta = root.MetaInformation || {};
  return {
    description: getText(meta.HighLevelSystemDescription) || '',
    assumptions: getText(meta.Assumptions) || '',
    externalDependencies: getText(meta.ExternalDependencies) || '',
    contributors: extractStringArray(meta.Contributors),
    owner: getText(meta.Owner) || '',
    reviewer: getText(meta.Reviewer) || '',
  };
}

// ─── Diagrams, Elements, Flows ──────────────────────────

function extractDiagrams(root: any): {
  diagrams: Tm7Diagram[];
  guidNameMap: Map<string, string>;
} {
  const surfaceList = root.DrawingSurfaceList;
  if (!surfaceList) return { diagrams: [], guidNameMap: new Map() };

  const surfaces = ensureArray(surfaceList.DrawingSurfaceModel);
  const guidNameMap = new Map<string, string>();
  const diagrams: Tm7Diagram[] = [];

  for (const surface of surfaces) {
    const guid = getText(surface.Guid) || '';
    const name = getPropertyValue(surface, 'Name') || `Diagram`;

    const elements = extractElements(surface, guidNameMap);
    const { flows, lineBoundaries } = extractFlows(surface);
    // LineBoundary elements are in the Lines section, add them to elements
    elements.push(...lineBoundaries);

    diagrams.push({ guid, name, elements, flows });
  }

  return { diagrams, guidNameMap };
}

function extractElements(
  surface: any,
  guidNameMap: Map<string, string>
): Tm7Element[] {
  const bordersObj = surface.Borders;
  if (!bordersObj) return [];

  const kvPairs = ensureArray(bordersObj.KeyValueOfguidanyType);
  const elements: Tm7Element[] = [];

  for (const kv of kvPairs) {
    const val = kv.Value;
    if (!val) continue;

    // Determine element type from xsi:type attribute
    const xsiType = val['@_type'] || val['@_xsi:type'] || '';
    // Strip any namespace prefix (e.g., "a:StencilEllipse" → "StencilEllipse")
    const bareType = xsiType.includes(':')
      ? xsiType.split(':').pop()!
      : xsiType;
    const elementType = STENCIL_TYPE_MAP[bareType];
    if (!elementType) continue; // Skip unknown stencil types

    const guid = getText(val.Guid) || '';
    const name = getPropertyValue(val, 'Name') || '';
    const description = getPropertyValue(val, 'Description') || '';
    const outOfScope =
      getPropertyValue(val, 'Out Of Scope') === 'true';
    const outOfScopeReason =
      getPropertyValue(val, 'Reason For Out Of Scope') || '';

    // Position and size — LineBoundary uses Source/Target coords, BorderBoundary uses Left/Top/Width/Height
    const isLineBoundary = bareType === 'LineBoundary';
    let x: number, y: number, width: number, height: number;
    let lineCoords: { sourceX: number; sourceY: number; targetX: number; targetY: number } | undefined;

    if (isLineBoundary) {
      const sx = parseFloat(getText(val.SourceX) || '0');
      const sy = parseFloat(getText(val.SourceY) || '0');
      const tx = parseFloat(getText(val.TargetX) || '0');
      const ty = parseFloat(getText(val.TargetY) || '0');
      x = Math.min(sx, tx);
      y = Math.min(sy, ty);
      width = Math.abs(tx - sx) || 4; // Lines may be nearly vertical/horizontal
      height = Math.abs(ty - sy) || 4;
      lineCoords = { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty };
    } else {
      x = parseFloat(getText(val.Left) || '0');
      y = parseFloat(getText(val.Top) || '0');
      width = parseFloat(getText(val.Width) || '100');
      height = parseFloat(getText(val.Height) || '100');
    }

    // Collect additional custom properties
    const properties = extractAllProperties(val);

    guidNameMap.set(guid, name);

    elements.push({
      guid,
      name,
      type: elementType,
      description,
      outOfScope,
      outOfScopeReason,
      position: { x, y },
      size: { width, height },
      properties,
      boundaryStyle: isLineBoundary ? 'line' : (bareType === 'BorderBoundary' ? 'box' : undefined),
      lineCoords,
    });
  }

  return elements;
}

function extractFlows(surface: any): { flows: Tm7Flow[]; lineBoundaries: Tm7Element[] } {
  const linesObj = surface.Lines;
  if (!linesObj) return { flows: [], lineBoundaries: [] };

  const kvPairs = ensureArray(linesObj.KeyValueOfguidanyType);
  const flows: Tm7Flow[] = [];
  const lineBoundaries: Tm7Element[] = [];

  for (const kv of kvPairs) {
    const key = getText(kv.Key) || '';
    const val = kv.Value;
    if (!val) continue;

    // Check if this is a LineBoundary (trust boundary line) vs a Connector (data flow)
    const xsiType = val['@_type'] || '';
    const bareType = xsiType.includes(':') ? xsiType.split(':').pop()! : xsiType;

    if (bareType === 'LineBoundary') {
      const guid = getText(val.Guid) || key;
      const name = getPropertyValue(val, 'Name') || 'Boundary Line';
      const sx = parseFloat(getText(val.SourceX) || '0');
      const sy = parseFloat(getText(val.SourceY) || '0');
      const tx = parseFloat(getText(val.TargetX) || '0');
      const ty = parseFloat(getText(val.TargetY) || '0');

      lineBoundaries.push({
        guid,
        name,
        type: 'TRUST_BOUNDARY',
        description: '',
        outOfScope: false,
        outOfScopeReason: '',
        position: { x: Math.min(sx, tx), y: Math.min(sy, ty) },
        size: { width: Math.abs(tx - sx) || 4, height: Math.abs(ty - sy) || 4 },
        properties: {},
        boundaryStyle: 'line',
        lineCoords: { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty },
      });
      continue;
    }

    const label = getPropertyValue(val, 'Name') || '';
    const sourceGuid = getText(val.SourceGuid) || '';
    const targetGuid = getText(val.TargetGuid) || '';
    const portSource = getText(val.PortSource) || '';
    const portTarget = getText(val.PortTarget) || '';
    const properties = extractAllProperties(val);

    flows.push({
      guid: key,
      label,
      sourceGuid,
      targetGuid,
      portSource,
      portTarget,
      properties,
    });
  }

  return { flows, lineBoundaries };
}

// ─── Threats ────────────────────────────────────────────

function extractThreats(
  root: any,
  guidNameMap: Map<string, string>,
  templates: Tm7ThreatTemplate[]
): Tm7Threat[] {
  const instances = root.ThreatInstances;
  if (!instances) return [];

  const kvPairs = ensureArray(
    instances.KeyValueOfstringThreatpc_P0_PhOB
  );
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const threats: Tm7Threat[] = [];

  for (const kv of kvPairs) {
    const val = kv.Value;
    if (!val) continue;

    const id = getText(val.Id) || '';
    const state = (getText(val.State) || 'NotStarted') as Tm7ThreatState;
    const priority = getText(val.Priority) || 'Medium';
    const diagramGuid = getText(val.DrawingSurfaceGuid) || '';
    const sourceGuid = getText(val.SourceGuid) || '';
    const targetGuid = getText(val.TargetGuid) || '';
    const flowGuid = getText(val.FlowGuid) || '';
    const changedBy = getText(val.ChangedBy) || '';
    const modifiedAt = getText(val.ModifiedAt) || '';
    const typeId = getText(val.TypeId) || '';

    // Threat details come from Properties KV pairs (custom threats)
    // or from KnowledgeBase templates (auto-generated threats)
    const props = extractThreatProperties(val);

    let title = props['Title'] || '';
    let description = props['UserThreatDescription'] || '';
    let category: Tm7StrideCategory = normalizeStrideCategory(
      props['UserThreatCategory'] || ''
    );
    const stateInformation = props['StateInformation'] || '';

    // If no custom title, try resolving from KB template
    if (!title && typeId) {
      const templateId = typeId.startsWith('BS')
        ? typeId.substring(2)
        : typeId;
      const template = templateMap.get(templateId) || templateMap.get(typeId);
      if (template) {
        const srcName = guidNameMap.get(sourceGuid) || 'Unknown';
        const tgtName = guidNameMap.get(targetGuid) || 'Unknown';
        title = resolveTemplate(template.titleTemplate, srcName, tgtName);
        description =
          description ||
          resolveTemplate(template.descriptionTemplate, srcName, tgtName);
        category =
          STRIDE_MAP[template.category] || category;
      }
    }

    threats.push({
      id,
      title,
      description,
      category,
      state,
      priority,
      stateInformation,
      diagramGuid,
      sourceGuid,
      targetGuid,
      flowGuid,
      changedBy,
      modifiedAt,
    });
  }

  return threats;
}

function extractThreatProperties(val: any): Record<string, string> {
  const propsObj = val.Properties;
  if (!propsObj) return {};

  const kvPairs = ensureArray(propsObj.KeyValueOfstringstring);
  const result: Record<string, string> = {};

  for (const kv of kvPairs) {
    const key = getText(kv.Key) || '';
    const value = getText(kv.Value) || '';
    if (key) result[key] = value;
  }

  return result;
}

// ─── Knowledge Base Templates ───────────────────────────

function extractThreatTemplates(root: any): Tm7ThreatTemplate[] {
  const kb = root.KnowledgeBase;
  if (!kb) return [];

  const ttSection = kb.ThreatTypes;
  if (!ttSection) return [];

  const types = ensureArray(ttSection.ThreatType);
  const templates: Tm7ThreatTemplate[] = [];

  for (const tt of types) {
    const id = getText(tt.Id) || '';
    const category = getText(tt.Category) || '';
    const titleTemplate = getText(tt.ShortTitle) || '';
    const descriptionTemplate = getText(tt.Description) || '';

    const genFilters = tt.GenerationFilters || {};
    const includeFilter = getText(genFilters.Include) || '';
    const excludeFilter = getText(genFilters.Exclude) || '';

    templates.push({
      id,
      category,
      titleTemplate,
      descriptionTemplate,
      includeFilter,
      excludeFilter,
    });
  }

  return templates;
}

// ─── STRIDE Normalization ───────────────────────────────

/**
 * Normalize STRIDE category strings that may have typos or variations.
 */
function normalizeStrideCategory(raw: string): Tm7StrideCategory {
  if (!raw) return 'Spoofing';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('spoof')) return 'Spoofing';
  if (lower.includes('tamper')) return 'Tampering';
  if (lower.includes('repud')) return 'Repudiation';
  if (lower.includes('info') || lower.includes('disclosure')) return 'Information Disclosure';
  if (lower.includes('denial') || lower.includes('dos')) return 'Denial of Service';
  if (lower.includes('elev') || lower.includes('privilege')) return 'Elevation of Privilege';
  return 'Spoofing';
}

// ─── Helpers ────────────────────────────────────────────

/**
 * Get text content from an XML element.
 * fast-xml-parser may return string, number, or object.
 */
function getText(node: any): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean')
    return String(node);
  // If it's an object with #text (mixed content)
  if (node['#text'] !== undefined) return String(node['#text']);
  return undefined;
}

/**
 * Get a named property value from a .tm7 element's Properties section.
 * Properties are stored as anyType elements with DisplayName/Value children.
 */
function getPropertyValue(element: any, displayName: string): string | undefined {
  const props = element.Properties;
  if (!props) return undefined;

  const anyTypes = ensureArray(props.anyType);
  for (const prop of anyTypes) {
    const dn = getText(prop.DisplayName);
    if (dn === displayName) {
      const val = prop.Value;
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'object') {
        // Could be { '#text': 'value', '@_type': 'c:string' } or { '@_nil': 'true' }
        if (val['@_nil'] === 'true') return undefined;
        return getText(val);
      }
      return String(val);
    }
  }
  return undefined;
}

/**
 * Extract all named properties as a flat key-value map.
 * Skips header properties (no value) and system properties.
 */
function extractAllProperties(element: any): Record<string, string> {
  const props = element.Properties;
  if (!props) return {};

  const anyTypes = ensureArray(props.anyType);
  const result: Record<string, string> = {};

  for (const prop of anyTypes) {
    const dn = getText(prop.DisplayName);
    if (!dn) continue;
    // Skip headers and already-extracted standard fields
    if (['Name', 'Description', 'Out Of Scope', 'Reason For Out Of Scope'].includes(dn))
      continue;

    const val = prop.Value;
    if (val === undefined || val === null) continue;
    if (typeof val === 'object' && val['@_nil'] === 'true') continue;

    const textVal = getText(val);
    if (textVal) result[dn] = textVal;

    // Handle list properties (SelectedIndex + array of string values)
    if (prop.SelectedIndex !== undefined && val?.string) {
      const options = ensureArray(val.string);
      const idx = parseInt(getText(prop.SelectedIndex) || '0', 10);
      if (options[idx] !== undefined) {
        result[dn] = String(options[idx]);
      }
    }
  }

  return result;
}

function extractStringArray(node: any): string[] {
  if (!node) return [];
  const items = ensureArray(node.string || node.Contributor || node);
  return items.map((s: any) => String(getText(s) || s)).filter(Boolean);
}

function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function resolveTemplate(
  template: string,
  sourceName: string,
  targetName: string
): string {
  return template
    .replace(/\{source\.Name\}/g, sourceName)
    .replace(/\{target\.Name\}/g, targetName);
}
