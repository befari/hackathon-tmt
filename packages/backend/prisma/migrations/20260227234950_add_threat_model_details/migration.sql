-- AlterTable
ALTER TABLE "threat_models" ADD COLUMN     "assumptions" TEXT,
ADD COLUMN     "devOwners" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "externalDependencies" TEXT,
ADD COLUMN     "m1Owner" TEXT;
