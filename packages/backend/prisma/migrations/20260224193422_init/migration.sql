-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('DRAFT', 'ANALYZING', 'READY', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('PROCESS', 'DATA_STORE', 'EXTERNAL_ENTITY', 'TRUST_BOUNDARY');

-- CreateEnum
CREATE TYPE "StrideCategory" AS ENUM ('SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFO_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "ThreatStatus" AS ENUM ('OPEN', 'MITIGATED', 'ACCEPTED', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "threat_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repoUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ModelStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "description" TEXT,
    "sourceFiles" TEXT[],
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_flows" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "protocol" TEXT,
    "dataClassification" TEXT,
    "crossesTrustBoundary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "data_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threats" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "strideCategory" "StrideCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "ThreatStatus" NOT NULL DEFAULT 'OPEN',
    "mitigationNotes" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION,
    "threatModelId" TEXT NOT NULL,
    "componentId" TEXT,
    "dataFlowId" TEXT,

    CONSTRAINT "threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "threatId" TEXT,
    "componentId" TEXT,
    "dataFlowId" TEXT,
    "parentId" TEXT,
    "reviewId" TEXT,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reviewerName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_embeddings" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "code_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_embeddings_threatModelId_idx" ON "code_embeddings"("threatModelId");

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_dataFlowId_fkey" FOREIGN KEY ("dataFlowId") REFERENCES "data_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_dataFlowId_fkey" FOREIGN KEY ("dataFlowId") REFERENCES "data_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
