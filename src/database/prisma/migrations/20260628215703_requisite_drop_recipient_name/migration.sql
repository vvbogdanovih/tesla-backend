/*
  Warnings:

  - You are about to drop the column `recipient_name` on the `payment_requisites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_requisites" DROP COLUMN "recipient_name";
