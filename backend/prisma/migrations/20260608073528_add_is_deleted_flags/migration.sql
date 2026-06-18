-- AlterTable
ALTER TABLE "expense_ledger" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "income_ledger" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
