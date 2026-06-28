/*
  Warnings:

  - You are about to drop the column `content` on the `blog_posts` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "blog_posts" DROP COLUMN "content",
ADD COLUMN     "content_html" TEXT,
ADD COLUMN     "content_json" JSONB;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "description",
ADD COLUMN     "description_html" TEXT,
ADD COLUMN     "description_json" JSONB;
