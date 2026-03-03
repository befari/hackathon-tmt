/*
  Warnings:

  - You are about to drop the column `threatModelId` on the `components` table. All the data in the column will be lost.
  - You are about to drop the column `threatModelId` on the `data_flows` table. All the data in the column will be lost.
  - Added the required column `diagramId` to the `components` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diagramId` to the `data_flows` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "components" DROP CONSTRAINT "components_threatModelId_fkey";

-- DropForeignKey
ALTER TABLE "data_flows" DROP CONSTRAINT "data_flows_threatModelId_fkey";

-- AlterTable
ALTER TABLE "components" DROP COLUMN "threatModelId",
ADD COLUMN     "diagramId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "data_flows" DROP COLUMN "threatModelId",
ADD COLUMN     "diagramId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "diagrams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "threatModelId" TEXT NOT NULL,

    CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_flows" ADD CONSTRAINT "data_flows_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
