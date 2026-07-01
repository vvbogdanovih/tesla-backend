-- AlterTable
ALTER TABLE "payment_requisites" ADD COLUMN     "monopay_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monopay_token" TEXT;
