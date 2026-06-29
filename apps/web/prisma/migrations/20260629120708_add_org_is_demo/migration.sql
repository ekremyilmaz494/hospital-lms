-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organization_is_demo_idx" ON "organizations"("is_demo");
