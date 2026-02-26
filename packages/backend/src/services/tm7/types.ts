/**
 * Normalized output types from the .tm7 XML parser.
 * These map closely to our Prisma models for easy import.
 */

export interface Tm7ParseResult {
  /** Metadata from the .tm7 file */
  metadata: Tm7Metadata;
  /** All diagrams (DrawingSurfaceModels) with their elements and flows */
  diagrams: Tm7Diagram[];
  /** All threats across all diagrams */
  threats: Tm7Threat[];
  /** Knowledge base threat type templates */
  threatTemplates: Tm7ThreatTemplate[];
}

export interface Tm7Metadata {
  /** High-level system description */
  description: string;
  /** Assumptions listed in the model */
  assumptions: string;
  /** External dependencies */
  externalDependencies: string;
  /** Contributors */
  contributors: string[];
  /** Owner */
  owner: string;
  /** Reviewer */
  reviewer: string;
}

export interface Tm7Diagram {
  /** Original GUID from the .tm7 */
  guid: string;
  /** Diagram name (e.g., "Agent - Cert Renewal") */
  name: string;
  /** All elements (processes, data stores, external entities, trust boundaries) */
  elements: Tm7Element[];
  /** All data flows connecting elements */
  flows: Tm7Flow[];
}

export type Tm7ElementType = 'PROCESS' | 'DATA_STORE' | 'EXTERNAL_ENTITY' | 'TRUST_BOUNDARY';

export interface Tm7Element {
  /** Original GUID from the .tm7 */
  guid: string;
  /** Element name */
  name: string;
  /** Mapped element type */
  type: Tm7ElementType;
  /** Description (from element notes/description property) */
  description: string;
  /** Whether element is marked out of scope */
  outOfScope: boolean;
  /** Reason for being out of scope */
  outOfScopeReason: string;
  /** Position on canvas */
  position: { x: number; y: number };
  /** Size on canvas */
  size: { width: number; height: number };
  /** For trust boundaries: 'box' (BorderBoundary) or 'line' (LineBoundary) */
  boundaryStyle?: 'box' | 'line';
  /** For LineBoundary: source and target coordinates of the line */
  lineCoords?: { sourceX: number; sourceY: number; targetX: number; targetY: number };
  /** Additional custom properties */
  properties: Record<string, string>;
}

export interface Tm7Flow {
  /** Original GUID (from the KV key) */
  guid: string;
  /** Flow label/name */
  label: string;
  /** Source element GUID */
  sourceGuid: string;
  /** Target element GUID */
  targetGuid: string;
  /** Source port (e.g., "East", "West", "North", "South", "NorthWest", etc.) */
  portSource: string;
  /** Target port */
  portTarget: string;
  /** Additional properties */
  properties: Record<string, string>;
}

export type Tm7ThreatState =
  | 'NotApplicable'
  | 'NeedsInvestigation'
  | 'Mitigated'
  | 'NotStarted';

export type Tm7StrideCategory =
  | 'Spoofing'
  | 'Tampering'
  | 'Repudiation'
  | 'Information Disclosure'
  | 'Denial of Service'
  | 'Elevation of Privilege';

export interface Tm7Threat {
  /** Threat ID from the .tm7 */
  id: string;
  /** Resolved title */
  title: string;
  /** Full threat description */
  description: string;
  /** STRIDE category */
  category: Tm7StrideCategory;
  /** Threat state */
  state: Tm7ThreatState;
  /** Priority (e.g., "High", "Medium", "Low") */
  priority: string;
  /** Mitigation justification or state info */
  stateInformation: string;
  /** GUID of the diagram this threat appears on */
  diagramGuid: string;
  /** GUID of the source element */
  sourceGuid: string;
  /** GUID of the target element */
  targetGuid: string;
  /** GUID of the flow (interaction) */
  flowGuid: string;
  /** Who last modified this threat */
  changedBy: string;
  /** When it was last modified */
  modifiedAt: string;
}

export interface Tm7ThreatTemplate {
  /** Template ID (e.g., "S1", "T2") */
  id: string;
  /** STRIDE category letter */
  category: string;
  /** Template title with placeholders like {source.Name} */
  titleTemplate: string;
  /** Template description with placeholders */
  descriptionTemplate: string;
  /** Generation filter rules */
  includeFilter: string;
  excludeFilter: string;
}
