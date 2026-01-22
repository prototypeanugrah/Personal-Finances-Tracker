import type { RawTransaction } from "../parser/xlsParser";

export interface MerchantInfo {
  merchant: string;
  method: "UPI" | "NEFT" | "IMPS" | "CARD" | "ATM" | "CHEQUE" | "OTHER";
}

export interface CategorizationRule {
  priority: number;
  categoryId: string;
  type: "keyword" | "regex" | "merchant" | "deposit" | "amount";
  pattern: string;
  field: "remarks" | "merchant";
  minAmount?: number;
  maxAmount?: number;
}

export interface CategorizedTransaction {
  serialNo: number;
  valueDate: number;
  transactionDate: number;
  chequeNumber?: string;
  remarks: string;
  withdrawalAmount: number;
  depositAmount: number;
  balance: number;
  categoryId: string;
  merchantName?: string;
  paymentMethod: string;
}

/**
 * Normalize text for matching
 */
function normalize(text: string): string {
  return text.toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Extract merchant info from UPI transaction remarks
 * UPI format: "UPI/MERCHANT_NAME/upi_id@bank/..."
 */
function extractUPIMerchant(remarks: string): string | null {
  const match = remarks.match(/^UPI\/([^\/]+)\//i);
  if (match) {
    return normalize(match[1]);
  }
  return null;
}

/**
 * Extract merchant info from NEFT transaction remarks
 * NEFT format: "NEFT-REF-NAME-DESC-ACCOUNT-IFSC" or similar
 */
function extractNEFTMerchant(remarks: string): string | null {
  // NEFT-AXOMB01602020708-ARUNA SHARMA-FAMILY-...
  const match = remarks.match(/^NEFT-[^-]+-([^-]+)-/i);
  if (match) {
    return normalize(match[1]);
  }
  return null;
}

/**
 * Extract merchant info from IMPS transaction remarks
 * IMPS format: "MMT/IMPS/ref/purpose/NAME" or similar
 */
function extractIMPSMerchant(remarks: string): string | null {
  // MMT/IMPS/601536454744/FUNDS TRANSFER/BILLIONBRA/Yes Bank
  const match = remarks.match(/^MMT\/IMPS\/[^\/]+\/([^\/]+)\/([^\/]+)/i);
  if (match) {
    // Return the merchant name (usually the 4th or 5th segment)
    return normalize(match[2]);
  }
  return null;
}

/**
 * Extract merchant info from BIL (Bill payment) transaction
 * BIL format: "BIL/INFT/FAP5100089/Family/NAME"
 */
function extractBILMerchant(remarks: string): string | null {
  const match = remarks.match(/^BIL\/[^\/]+\/[^\/]+\/([^\/]+)\//i);
  if (match) {
    return normalize(match[1]);
  }
  return null;
}

/**
 * Extract merchant info from VIN transaction (Visa/card)
 */
function extractVINMerchant(remarks: string): string | null {
  const match = remarks.match(/^VIN\/([^\/]+)\//i);
  if (match) {
    return normalize(match[1]);
  }
  return null;
}

/**
 * Extract merchant name and payment method from transaction remarks
 */
export function extractMerchant(remarks: string): MerchantInfo {
  const normalizedRemarks = remarks.toUpperCase();

  // UPI transaction
  if (normalizedRemarks.startsWith("UPI/")) {
    const merchant = extractUPIMerchant(remarks);
    return {
      merchant: merchant || "Unknown UPI",
      method: "UPI",
    };
  }

  // NEFT transaction
  if (normalizedRemarks.startsWith("NEFT")) {
    const merchant = extractNEFTMerchant(remarks);
    return {
      merchant: merchant || "Unknown NEFT",
      method: "NEFT",
    };
  }

  // IMPS transaction
  if (normalizedRemarks.startsWith("MMT/IMPS")) {
    const merchant = extractIMPSMerchant(remarks);
    return {
      merchant: merchant || "Unknown IMPS",
      method: "IMPS",
    };
  }

  // Bill payment / Internal transfer
  if (normalizedRemarks.startsWith("BIL/")) {
    const merchant = extractBILMerchant(remarks);
    return {
      merchant: merchant || "Bill Payment",
      method: "OTHER",
    };
  }

  // Card transaction (VIN)
  if (normalizedRemarks.startsWith("VIN/")) {
    const merchant = extractVINMerchant(remarks);
    return {
      merchant: merchant || "Card Payment",
      method: "CARD",
    };
  }

  // ATM transaction
  if (
    normalizedRemarks.includes("ATM") ||
    normalizedRemarks.includes("CASH WITHDRAWAL")
  ) {
    return {
      merchant: "ATM Withdrawal",
      method: "ATM",
    };
  }

  // Cheque
  if (normalizedRemarks.includes("CHQ") || normalizedRemarks.includes("CHEQUE")) {
    return {
      merchant: "Cheque",
      method: "CHEQUE",
    };
  }

  return {
    merchant: "Unknown",
    method: "OTHER",
  };
}

/**
 * Check if a transaction matches a rule
 */
function matchesRule(
  transaction: {
    remarks: string;
    merchantName?: string;
    withdrawalAmount: number;
    depositAmount: number;
  },
  rule: CategorizationRule
): boolean {
  // Amount-based filtering
  if (rule.minAmount !== undefined || rule.maxAmount !== undefined) {
    const amount = transaction.withdrawalAmount || transaction.depositAmount;
    if (rule.minAmount !== undefined && amount < rule.minAmount) return false;
    if (rule.maxAmount !== undefined && amount > rule.maxAmount) return false;
  }

  // Deposit-type rule (only matches deposits)
  if (rule.type === "deposit") {
    if (transaction.depositAmount <= 0) return false;
    // If pattern is provided, also check keywords
    if (rule.pattern) {
      const keywords = rule.pattern.split("|");
      const text = normalize(transaction.remarks);
      return keywords.some((kw) => text.includes(normalize(kw)));
    }
    return true;
  }

  // Get the text to match against
  const text =
    rule.field === "merchant"
      ? normalize(transaction.merchantName || "")
      : normalize(transaction.remarks);

  if (rule.type === "keyword") {
    // Keyword matching (OR logic with pipe-separated keywords)
    const keywords = rule.pattern.split("|");
    return keywords.some((kw) => text.includes(normalize(kw)));
  }

  if (rule.type === "regex") {
    // Regex matching
    try {
      const regex = new RegExp(rule.pattern, "i");
      return regex.test(text);
    } catch {
      return false;
    }
  }

  if (rule.type === "merchant") {
    // Exact merchant matching
    return text === normalize(rule.pattern);
  }

  return false;
}

/**
 * Categorize a single transaction using rules
 */
export function categorizeTransaction(
  transaction: {
    remarks: string;
    merchantName?: string;
    withdrawalAmount: number;
    depositAmount: number;
  },
  rules: CategorizationRule[]
): string {
  // Sort rules by priority (lower = higher priority)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (matchesRule(transaction, rule)) {
      return rule.categoryId;
    }
  }

  // Default: Check if it's income or expense
  if (transaction.depositAmount > 0) {
    return "income";
  }

  return "uncategorized";
}

/**
 * Process raw transactions and add categorization
 */
export function processTransactions(
  rawTransactions: RawTransaction[],
  rules: CategorizationRule[]
): CategorizedTransaction[] {
  return rawTransactions.map((tx) => {
    const merchantInfo = extractMerchant(tx.remarks);

    const categorized: CategorizedTransaction = {
      serialNo: tx.serialNo,
      valueDate: tx.valueDate.getTime(),
      transactionDate: tx.transactionDate.getTime(),
      chequeNumber: tx.chequeNumber,
      remarks: tx.remarks,
      withdrawalAmount: tx.withdrawalAmount,
      depositAmount: tx.depositAmount,
      balance: tx.balance,
      merchantName: merchantInfo.merchant,
      paymentMethod: merchantInfo.method,
      categoryId: categorizeTransaction(
        {
          remarks: tx.remarks,
          merchantName: merchantInfo.merchant,
          withdrawalAmount: tx.withdrawalAmount,
          depositAmount: tx.depositAmount,
        },
        rules
      ),
    };

    return categorized;
  });
}
