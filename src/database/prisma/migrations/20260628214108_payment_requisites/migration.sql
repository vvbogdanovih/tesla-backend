-- CreateTable
CREATE TABLE "payment_requisites" (
    "id" BIGSERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "recipient_name" TEXT,
    "tax_id" TEXT,
    "iban" TEXT,
    "bank_name" TEXT,
    "liqpay_public_key" TEXT,
    "liqpay_private_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requisites_pkey" PRIMARY KEY ("id")
);
