/*
  Warnings:

  - You are about to drop the column `is_active` on the `payment_requisites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_requisites" DROP COLUMN "is_active",
ADD COLUMN     "iban_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liqpay_active" BOOLEAN NOT NULL DEFAULT false;
