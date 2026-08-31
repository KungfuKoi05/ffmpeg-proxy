-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'PRO_PLUS', 'BUSINESS');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED_MANUFACTURER', 'VERIFIED_DISTRIBUTOR', 'SECONDARY_SOURCE', 'USER_SUBMITTED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "PublishState" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompatibilityState" AS ENUM ('COMPATIBLE', 'INCOMPATIBLE', 'CONDITIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('INTERFACE_MATCH', 'THREAD_MATCH', 'PLATFORM_MATCH', 'CALIBER_MATCH', 'GAS_SYSTEM_MATCH', 'DIMENSIONAL_CONSTRAINT', 'EXPLICIT_PAIR', 'REQUIRES_COMPONENT', 'MUTUALLY_EXCLUSIVE');

-- CreateEnum
CREATE TYPE "AttachmentRole" AS ENUM ('PROVIDES', 'CONSUMES');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'BACKORDER', 'OUT_OF_STOCK', 'DISCONTINUED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegulatoryClass" AS ENUM ('UNREGULATED_ACCESSORY', 'SERIALIZED_COMPONENT', 'NFA_ITEM', 'RESTRICTED_OTHER', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('MANUFACTURER_SITE', 'DISTRIBUTOR', 'RETAILER', 'MANUAL_ENTRY', 'IMPORT_FILE', 'USER_SUBMISSION', 'DEMO_FIXTURE');

-- CreateEnum
CREATE TYPE "ImportRecordState" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'DUPLICATE', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportBatchState" AS ENUM ('DRAFT', 'VALIDATING', 'READY_FOR_REVIEW', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('GLB', 'GLTF', 'PLACEHOLDER_PRIMITIVE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PRICE_DROP', 'PRICE_RISE', 'BACK_IN_STOCK', 'CATALOG_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planRenewsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "country" TEXT,
    "supportUrl" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "manufacturerPartNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "caliber" TEXT,
    "platform" TEXT,
    "msrpCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "weightGrams" INTEGER,
    "lengthMm" DECIMAL(10,3),
    "widthMm" DECIMAL(10,3),
    "heightMm" DECIMAL(10,3),
    "diameterMm" DECIMAL(10,3),
    "innerDiameterMm" DECIMAL(10,3),
    "material" TEXT,
    "finish" TEXT,
    "mountingInterface" TEXT,
    "threadSpecification" TEXT,
    "gasSystemCompatibility" TEXT,
    "handguardInterface" TEXT,
    "receiverInterface" TEXT,
    "opticInterface" TEXT,
    "suppressorCompatibility" TEXT,
    "barrelCompatibility" TEXT,
    "description" TEXT,
    "manufacturerUrl" TEXT,
    "productUrl" TEXT,
    "imageUrl" TEXT,
    "cadAssetUrl" TEXT,
    "technicalDrawingUrl" TEXT,
    "manualUrl" TEXT,
    "dataSourceId" TEXT,
    "sourceUrl" TEXT,
    "lastVerified" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "regulatoryClass" "RegulatoryClass" NOT NULL DEFAULT 'UNCLASSIFIED',
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "publishState" "PublishState" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "dataQualityScore" INTEGER,
    "dataQualityIssues" JSONB,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "finish" TEXT,
    "msrpCents" INTEGER,
    "weightGrams" INTEGER,
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "numericValue" DECIMAL(14,4),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "dataSourceId" TEXT,
    "sourceUrl" TEXT,
    "lastVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueMm" DECIMAL(10,3) NOT NULL,
    "toleranceMm" DECIMAL(10,3),
    "axis" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilityRule" (
    "id" TEXT NOT NULL,
    "kind" "RuleKind" NOT NULL,
    "name" TEXT NOT NULL,
    "subjectCategorySlug" TEXT,
    "targetCategorySlug" TEXT,
    "subjectProductId" TEXT,
    "targetProductId" TEXT,
    "subjectField" TEXT,
    "targetField" TEXT,
    "parameters" JSONB,
    "result" "CompatibilityState" NOT NULL,
    "explanation" TEXT NOT NULL,
    "condition" TEXT,
    "sourceUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentPoint" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" "AttachmentRole" NOT NULL,
    "interface" TEXT NOT NULL,
    "offsetXMm" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "offsetYMm" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "offsetZMm" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "rotXDeg" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "rotYDeg" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "rotZDeg" DECIMAL(8,3) NOT NULL DEFAULT 0,

    CONSTRAINT "AttachmentPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL DEFAULT 'PLACEHOLDER_PRIMITIVE',
    "url" TEXT,
    "isApproximate" BOOLEAN NOT NULL DEFAULT true,
    "lodLevel" INTEGER NOT NULL DEFAULT 0,
    "fileSizeBytes" INTEGER,
    "boundingBox" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeDAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "affiliateTag" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "salePriceCents" INTEGER,
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "productUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT,
    "caliber" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "cachedSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildComponent" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceSnapshotCents" INTEGER,
    "notes" TEXT,
    "transform" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedComparison" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonEntry" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComparisonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPriceCents" INTEGER,
    "lastSeenPriceCents" INTEGER,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecentlyViewedProduct" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentlyViewedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "emailQueuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "url" TEXT,
    "trustWeight" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "createdById" TEXT,
    "state" "ImportBatchState" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "state" "ImportRecordState" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB NOT NULL,
    "normalized" JSONB,
    "issues" JSONB,
    "duplicateOfProductId" TEXT,
    "createdProductId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_slug_key" ON "Manufacturer"("slug");

-- CreateIndex
CREATE INDEX "Manufacturer_name_idx" ON "Manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_publishState_idx" ON "Product"("categoryId", "publishState");

-- CreateIndex
CREATE INDEX "Product_platform_idx" ON "Product"("platform");

-- CreateIndex
CREATE INDEX "Product_caliber_idx" ON "Product"("caliber");

-- CreateIndex
CREATE INDEX "Product_verificationStatus_idx" ON "Product"("verificationStatus");

-- CreateIndex
CREATE INDEX "Product_msrpCents_idx" ON "Product"("msrpCents");

-- CreateIndex
CREATE INDEX "Product_weightGrams_idx" ON "Product"("weightGrams");

-- CreateIndex
CREATE INDEX "Product_publishState_updatedAt_idx" ON "Product"("publishState", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_manufacturerId_manufacturerPartNumber_key" ON "Product"("manufacturerId", "manufacturerPartNumber");

-- CreateIndex
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");

-- CreateIndex
CREATE INDEX "Specification_key_idx" ON "Specification"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Specification_productId_key_key" ON "Specification"("productId", "key");

-- CreateIndex
CREATE INDEX "Dimension_kind_idx" ON "Dimension"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_productId_kind_key" ON "Dimension"("productId", "kind");

-- CreateIndex
CREATE INDEX "CompatibilityRule_kind_isActive_idx" ON "CompatibilityRule"("kind", "isActive");

-- CreateIndex
CREATE INDEX "CompatibilityRule_subjectCategorySlug_targetCategorySlug_idx" ON "CompatibilityRule"("subjectCategorySlug", "targetCategorySlug");

-- CreateIndex
CREATE INDEX "AttachmentPoint_interface_idx" ON "AttachmentPoint"("interface");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentPoint_productId_slug_key" ON "AttachmentPoint"("productId", "slug");

-- CreateIndex
CREATE INDEX "ThreeDAsset_productId_lodLevel_idx" ON "ThreeDAsset"("productId", "lodLevel");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_slug_key" ON "Retailer"("slug");

-- CreateIndex
CREATE INDEX "Price_productId_observedAt_idx" ON "Price"("productId", "observedAt");

-- CreateIndex
CREATE INDEX "Price_productId_isCurrent_idx" ON "Price"("productId", "isCurrent");

-- CreateIndex
CREATE INDEX "Price_retailerId_idx" ON "Price"("retailerId");

-- CreateIndex
CREATE INDEX "Build_ownerId_isArchived_updatedAt_idx" ON "Build"("ownerId", "isArchived", "updatedAt");

-- CreateIndex
CREATE INDEX "BuildComponent_buildId_idx" ON "BuildComponent"("buildId");

-- CreateIndex
CREATE INDEX "BuildComponent_productId_idx" ON "BuildComponent"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildComponent_buildId_slotKey_productId_key" ON "BuildComponent"("buildId", "slotKey", "productId");

-- CreateIndex
CREATE INDEX "SavedComparison_ownerId_updatedAt_idx" ON "SavedComparison"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonEntry_comparisonId_buildId_key" ON "ComparisonEntry"("comparisonId", "buildId");

-- CreateIndex
CREATE INDEX "SavedSearch_ownerId_idx" ON "SavedSearch"("ownerId");

-- CreateIndex
CREATE INDEX "WatchlistItem_productId_idx" ON "WatchlistItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_ownerId_productId_key" ON "WatchlistItem"("ownerId", "productId");

-- CreateIndex
CREATE INDEX "RecentlyViewedProduct_ownerId_viewedAt_idx" ON "RecentlyViewedProduct"("ownerId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentlyViewedProduct_ownerId_productId_key" ON "RecentlyViewedProduct"("ownerId", "productId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_slug_key" ON "DataSource"("slug");

-- CreateIndex
CREATE INDEX "ImportBatch_state_createdAt_idx" ON "ImportBatch"("state", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRecord_batchId_state_idx" ON "ImportRecord"("batchId", "state");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dimension" ADD CONSTRAINT "Dimension_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_subjectProductId_fkey" FOREIGN KEY ("subjectProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentPoint" ADD CONSTRAINT "AttachmentPoint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDAsset" ADD CONSTRAINT "ThreeDAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildComponent" ADD CONSTRAINT "BuildComponent_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildComponent" ADD CONSTRAINT "BuildComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedComparison" ADD CONSTRAINT "SavedComparison_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "SavedComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentlyViewedProduct" ADD CONSTRAINT "RecentlyViewedProduct_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentlyViewedProduct" ADD CONSTRAINT "RecentlyViewedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
