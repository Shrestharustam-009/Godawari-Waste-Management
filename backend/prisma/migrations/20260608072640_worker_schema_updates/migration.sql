/*
  Warnings:

  - Added the required column `baseAmount` to the `income_ledger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatAmount` to the `income_ledger` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESSFUL', 'PENDING', 'FAILED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "debtStartDate" TIMESTAMP(3),
ADD COLUMN     "lastBilledDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "income_ledger" ADD COLUMN     "baseAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESSFUL',
ADD COLUMN     "vatAmount" DECIMAL(10,2) NOT NULL;
