// ==================== Enums ====================

export enum ModelStatus {
  DRAFT = 'DRAFT',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  REVIEWED = 'REVIEWED',
}

export enum ComponentType {
  PROCESS = 'PROCESS',
  DATA_STORE = 'DATA_STORE',
  EXTERNAL_ENTITY = 'EXTERNAL_ENTITY',
  TRUST_BOUNDARY = 'TRUST_BOUNDARY',
}

export enum StrideCategory {
  SPOOFING = 'SPOOFING',
  TAMPERING = 'TAMPERING',
  REPUDIATION = 'REPUDIATION',
  INFO_DISCLOSURE = 'INFO_DISCLOSURE',
  DENIAL_OF_SERVICE = 'DENIAL_OF_SERVICE',
  ELEVATION_OF_PRIVILEGE = 'ELEVATION_OF_PRIVILEGE',
}

export enum Severity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO',
}

export enum ThreatStatus {
  OPEN = 'OPEN',
  MITIGATED = 'MITIGATED',
  ACCEPTED = 'ACCEPTED',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

export enum ReviewStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ==================== Types ====================

export interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  repoUrl?: string;
  version: number;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
  diagrams?: Diagram[];
  threats?: Threat[];
  reviews?: Review[];
}

export interface Diagram {
  id: string;
  name: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  threatModelId: string;
  components?: Component[];
  dataFlows?: DataFlow[];
}

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  sourceFiles: string[];
  positionX: number;
  positionY: number;
  metadata?: Record<string, unknown>;
  diagramId: string;
}

export interface DataFlow {
  id: string;
  label: string;
  protocol?: string;
  dataClassification?: string;
  crossesTrustBoundary: boolean;
  metadata?: Record<string, unknown>;
  sourceId: string;
  targetId: string;
  diagramId: string;
}

export interface Threat {
  id: string;
  number: number;
  title: string;
  description: string;
  strideCategory: StrideCategory;
  severity: Severity;
  status: ThreatStatus;
  mitigationNotes?: string;
  aiGenerated: boolean;
  confidence?: number;
  threatModelId: string;
  componentId?: string;
  dataFlowId?: string;
}

export interface Comment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  threatId?: string;
  componentId?: string;
  dataFlowId?: string;
  parentId?: string;
  reviewId?: string;
  replies?: Comment[];
}

export interface Review {
  id: string;
  name: string;
  status: ReviewStatus;
  reviewerName?: string;
  startedAt: string;
  completedAt?: string;
  threatModelId: string;
  comments?: Comment[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  threatModelId: string;
}

// ==================== API Types ====================

export interface CreateThreatModelRequest {
  name: string;
  description?: string;
  repoUrl?: string;
}

export interface UpdateThreatModelRequest {
  name?: string;
  description?: string;
  status?: ModelStatus;
}

export interface CreateCommentRequest {
  body: string;
  author: string;
  threatId?: string;
  componentId?: string;
  dataFlowId?: string;
  parentId?: string;
  reviewId?: string;
}

export interface CreateReviewRequest {
  name: string;
  reviewerName?: string;
  threatModelId: string;
}

export interface ChatRequest {
  message: string;
  threatModelId: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Auth ====================

export enum MemberRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  REVIEWER = 'REVIEWER',
  VIEWER = 'VIEWER',
}

export interface User {
  id: string;
  entraId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface ThreatModelMember {
  id: string;
  role: MemberRole;
  userId: string;
  threatModelId: string;
  user?: User;
  createdAt: string;
}

export interface ShareLink {
  id: string;
  token: string;
  role: MemberRole;
  active: boolean;
  threatModelId: string;
  createdAt: string;
  expiresAt?: string;
}
