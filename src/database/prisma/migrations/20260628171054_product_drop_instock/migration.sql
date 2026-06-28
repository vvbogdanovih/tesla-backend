/*
  Warnings:

  - You are about to drop the column `in_stock` on the `products` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "products_is_active_in_stock_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "in_stock";

-- CreateIndex
CREATE INDEX "products_is_active_stock_qty_idx" ON "products"("is_active", "stock_qty");
