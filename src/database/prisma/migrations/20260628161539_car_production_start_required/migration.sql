/*
  Warnings:

  - Made the column `production_start` on table `cars` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "cars" ALTER COLUMN "production_start" SET NOT NULL;
