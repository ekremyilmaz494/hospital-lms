-- Ortak personel kimliği (Track 2, çok-hastaneli grup) — additive + fresh-DB-safe.
-- Bir çalışan TEK hesapla birden çok hastanede eğitim alabilir. User.organizationId
-- home/primary KALIR; organization_memberships EK hastaneleri temsil eder (disjoint).
-- Faz 2.1'de UYKUDA: hiçbir yol henüz okumaz. Yalnız CREATE TABLE + index + FK
-- (veri işlemi/backfill/ALTER TYPE YOK). Invariant (membership.org ≠ primary org) kodda zorlanır.

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'staff',
    "department_id" UUID,
    "title" VARCHAR(100),
    "external_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_org_memberships_org" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "idx_org_memberships_user" ON "organization_memberships"("user_id");

-- CreateIndex
CREATE INDEX "idx_org_memberships_org_active" ON "organization_memberships"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_org_memberships_department" ON "organization_memberships"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_org_memberships_user_org_unique" ON "organization_memberships"("user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
