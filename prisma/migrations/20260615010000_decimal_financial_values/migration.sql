ALTER TABLE "Lot"
ALTER COLUMN "price" TYPE DECIMAL(15, 2)
USING ROUND("price"::numeric, 2);

ALTER TABLE "Proposal"
ALTER COLUMN "salePrice" TYPE DECIMAL(15, 2) USING ROUND("salePrice"::numeric, 2),
ALTER COLUMN "downPayment" TYPE DECIMAL(15, 2) USING ROUND("downPayment"::numeric, 2),
ALTER COLUMN "installmentValue" TYPE DECIMAL(15, 2) USING ROUND("installmentValue"::numeric, 2),
ALTER COLUMN "balance" TYPE DECIMAL(15, 2) USING ROUND("balance"::numeric, 2),
ALTER COLUMN "totalValue" TYPE DECIMAL(15, 2) USING ROUND("totalValue"::numeric, 2);

ALTER TABLE "Sale"
ALTER COLUMN "installmentValue" TYPE DECIMAL(15, 2) USING ROUND("installmentValue"::numeric, 2),
ALTER COLUMN "downPayment" TYPE DECIMAL(15, 2) USING ROUND("downPayment"::numeric, 2),
ALTER COLUMN "totalValue" TYPE DECIMAL(15, 2) USING ROUND("totalValue"::numeric, 2);

ALTER TABLE "Receivable"
ALTER COLUMN "amount" TYPE DECIMAL(15, 2) USING ROUND("amount"::numeric, 2),
ALTER COLUMN "paidAmount" DROP DEFAULT,
ALTER COLUMN "paidAmount" TYPE DECIMAL(15, 2) USING ROUND("paidAmount"::numeric, 2),
ALTER COLUMN "paidAmount" SET DEFAULT 0,
ALTER COLUMN "balance" TYPE DECIMAL(15, 2) USING ROUND("balance"::numeric, 2);
