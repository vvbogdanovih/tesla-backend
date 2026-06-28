/*
  Warnings:

  - You are about to drop the column `delivery_terms` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `warranty` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "delivery_terms",
DROP COLUMN "warranty";

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_json" JSONB,
    "body_html" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_key_key" ON "content_blocks"("key");
