-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "is_live" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_images_product_id_is_live_idx" ON "product_images"("product_id", "is_live");
