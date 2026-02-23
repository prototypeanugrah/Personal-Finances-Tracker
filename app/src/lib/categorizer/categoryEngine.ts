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
  statementType: "debit" | "credit";
  rewardPoints?: number;
}

export interface HistoricalCategorizedTransaction {
  remarks: string;
  merchantName?: string;
  categoryId: string;
  userCategoryOverride?: string;
  withdrawalAmount: number;
  depositAmount: number;
}

export interface ProcessTransactionsOptions {
  historicalTransactions?: HistoricalCategorizedTransaction[];
}

interface MerchantCategoryHint {
  categoryId: string;
  count: number;
  confidence: number;
}

interface CategorizationOptions {
  merchantHints?: Map<string, MerchantCategoryHint>;
}

/**
 * Normalize text for matching
 */
function normalize(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9@&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMerchantKey(text: string): string {
  return normalize(text).replace(/[@&]/g, "").replace(/\s+/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MERCHANT_NOISE_WORDS = new Set([
  "UPI",
  "MMT",
  "IMPS",
  "NEFT",
  "BIL",
  "VIN",
  "VPS",
  "INFT",
  "TRF",
  "DR",
  "CR",
  "REF",
  "REFNO",
  "TRANSFER",
  "PAYMENT",
  "PAY",
  "TO",
  "FROM",
  "ACCOUNT",
  "ACC",
  "CARD",
  "DEBIT",
  "CREDIT",
  "TXN",
  "TRANSACTION",
  "CHARGE",
  "ATM",
  "CHEQUE",
  "CHQ",
  "UNKNOWN",
]);

function isLikelyMerchantToken(token: string): boolean {
  const normalizedToken = normalize(token);
  if (!normalizedToken) return false;
  if (!/[A-Z]/.test(normalizedToken)) return false;

  const compact = normalizedToken.replace(/\s+/g, "");
  if (compact.length < 3) return false;
  if (/^\d+$/.test(compact)) return false;
  if (MERCHANT_NOISE_WORDS.has(compact)) return false;

  return true;
}

function extractLikelyMerchant(remarks: string): string | null {
  const segments = remarks
    .split(/[\/|:;\-_*]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const rawSegment of segments) {
    const segment = rawSegment.includes("@")
      ? rawSegment.split("@")[0] || rawSegment
      : rawSegment;

    if (!isLikelyMerchantToken(segment)) {
      continue;
    }

    return normalize(segment);
  }

  return null;
}

/**
 * Extract merchant info from UPI transaction remarks
 * UPI format: "UPI/MERCHANT_NAME/upi_id@bank/..."
 */
function extractUPIMerchant(remarks: string): string | null {
  return extractLikelyMerchant(remarks);
}

/**
 * Extract merchant info from NEFT transaction remarks
 * NEFT format: "NEFT-REF-NAME-DESC-ACCOUNT-IFSC" or similar
 */
function extractNEFTMerchant(remarks: string): string | null {
  return extractLikelyMerchant(remarks);
}

/**
 * Extract merchant info from IMPS transaction remarks
 * IMPS format: "MMT/IMPS/ref/purpose/NAME" or similar
 */
function extractIMPSMerchant(remarks: string): string | null {
  return extractLikelyMerchant(remarks);
}

/**
 * Extract merchant info from BIL (Bill payment) transaction
 * BIL format: "BIL/INFT/FAP5100089/Family/NAME"
 */
function extractBILMerchant(remarks: string): string | null {
  return extractLikelyMerchant(remarks);
}

/**
 * Extract merchant info from VIN transaction (Visa/card)
 */
function extractVINMerchant(remarks: string): string | null {
  return extractLikelyMerchant(remarks);
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
    merchant: extractLikelyMerchant(remarks) || "Unknown",
    method: "OTHER",
  };
}

/**
 * Score keyword quality (higher = better match quality)
 */
function scoreKeywordMatch(text: string, pattern: string): number {
  const keywords = pattern
    .split("|")
    .map((token) => normalize(token))
    .filter(Boolean);

  let bestScore = 0;

  for (const keyword of keywords) {
    const escapedKeyword = escapeRegExp(keyword).replace(/\s+/g, "\\s+");
    const boundaryRegex = new RegExp(`(?:^|\\b)${escapedKeyword}(?:\\b|$)`, "i");
    const compactLength = keyword.replace(/\s+/g, "").length;
    const lengthBoost = Math.min(compactLength, 20) * 1.2;

    if (boundaryRegex.test(text)) {
      bestScore = Math.max(bestScore, 45 + lengthBoost);
      continue;
    }

    if (text.includes(keyword)) {
      bestScore = Math.max(bestScore, 28 + lengthBoost);
    }
  }

  return bestScore;
}

/**
 * Score a rule against a transaction (0 = no match)
 */
function getRuleMatchScore(
  transaction: {
    remarks: string;
    merchantName?: string;
    withdrawalAmount: number;
    depositAmount: number;
  },
  rule: CategorizationRule
): number {
  // Amount-based filtering
  if (rule.minAmount !== undefined || rule.maxAmount !== undefined) {
    const amount = transaction.withdrawalAmount || transaction.depositAmount;
    if (rule.minAmount !== undefined && amount < rule.minAmount) return 0;
    if (rule.maxAmount !== undefined && amount > rule.maxAmount) return 0;
  }

  const priorityBoost = Math.max(0, 25 - Math.min(rule.priority, 25)) * 0.7;

  // Deposit-type rule (only matches deposits)
  if (rule.type === "deposit") {
    if (transaction.depositAmount <= 0) return 0;
    if (!rule.pattern) {
      return 65 + priorityBoost;
    }

    const keywordScore = scoreKeywordMatch(normalize(transaction.remarks), rule.pattern);
    if (keywordScore <= 0) return 0;

    return 35 + keywordScore + priorityBoost;
  }

  // Get the text to match against
  const text =
    rule.field === "merchant"
      ? normalize(transaction.merchantName || "")
      : normalize(transaction.remarks);

  if (rule.type === "keyword") {
    const keywordScore = scoreKeywordMatch(text, rule.pattern);
    if (keywordScore <= 0) return 0;
    return 20 + keywordScore + priorityBoost;
  }

  if (rule.type === "regex") {
    try {
      const regex = new RegExp(rule.pattern, "i");
      return regex.test(text) ? 95 + priorityBoost : 0;
    } catch {
      return 0;
    }
  }

  if (rule.type === "merchant") {
    return text === normalize(rule.pattern) ? 100 + priorityBoost : 0;
  }

  if (rule.type === "amount") {
    return 55 + priorityBoost;
  }

  return 0;
}

function buildMerchantHints(
  historicalTransactions: HistoricalCategorizedTransaction[]
): Map<string, MerchantCategoryHint> {
  const byMerchant = new Map<string, { total: number; byCategory: Map<string, number> }>();

  for (const tx of historicalTransactions) {
    const effectiveCategory = tx.userCategoryOverride || tx.categoryId;
    if (!effectiveCategory || effectiveCategory === "uncategorized") {
      continue;
    }

    const inferredMerchant = tx.merchantName || extractMerchant(tx.remarks).merchant;
    const merchantKey = normalizeMerchantKey(inferredMerchant);
    if (merchantKey.length < 3 || merchantKey === "UNKNOWN") {
      continue;
    }

    const existing =
      byMerchant.get(merchantKey) || { total: 0, byCategory: new Map<string, number>() };
    existing.total += 1;
    existing.byCategory.set(
      effectiveCategory,
      (existing.byCategory.get(effectiveCategory) || 0) + 1
    );
    byMerchant.set(merchantKey, existing);
  }

  const hints = new Map<string, MerchantCategoryHint>();
  for (const [merchantKey, stats] of byMerchant.entries()) {
    const sortedCategories = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length === 0) continue;

    const [topCategory, topCount] = sortedCategories[0];
    const confidence = topCount / stats.total;
    if (topCount < 2 || confidence < 0.65) {
      continue;
    }

    hints.set(merchantKey, {
      categoryId: topCategory,
      count: topCount,
      confidence,
    });
  }

  return hints;
}

function categoryFromHints(
  transaction: {
    merchantName?: string;
  },
  merchantHints?: Map<string, MerchantCategoryHint>
): string | null {
  if (!merchantHints || !transaction.merchantName) return null;

  const merchantKey = normalizeMerchantKey(transaction.merchantName);
  if (!merchantKey || merchantKey.length < 3 || merchantKey === "UNKNOWN") {
    return null;
  }

  const hint = merchantHints.get(merchantKey);
  if (!hint) return null;
  if (hint.count < 2 || hint.confidence < 0.65) return null;

  return hint.categoryId;
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
  rules: CategorizationRule[],
  options: CategorizationOptions = {}
): string {
  let bestMatch: { categoryId: string; score: number; priority: number } | null = null;

  for (const rule of rules) {
    const score = getRuleMatchScore(transaction, rule);
    if (score <= 0) continue;

    if (
      !bestMatch ||
      score > bestMatch.score ||
      (score === bestMatch.score && rule.priority < bestMatch.priority)
    ) {
      bestMatch = { categoryId: rule.categoryId, score, priority: rule.priority };
    }
  }

  if (bestMatch && bestMatch.score >= 60) {
    return bestMatch.categoryId;
  }

  const hintedCategory = categoryFromHints(transaction, options.merchantHints);
  if (hintedCategory) {
    return hintedCategory;
  }

  const normalizedRemarks = normalize(transaction.remarks);

  if (
    normalizedRemarks.includes("ATM") ||
    normalizedRemarks.includes("CASH WITHDRAWAL") ||
    normalizedRemarks.includes("SELF TRANSFER")
  ) {
    return "transfers";
  }

  if (transaction.depositAmount > 0) {
    if (normalizedRemarks.includes("SALARY") || normalizedRemarks.includes("PAYROLL")) {
      return "salary";
    }
    if (
      normalizedRemarks.includes("REFUND") ||
      normalizedRemarks.includes("REVERSAL") ||
      normalizedRemarks.includes("CASHBACK") ||
      normalizedRemarks.includes("REWARD")
    ) {
      return "refunds";
    }
    return "income";
  }

  return "uncategorized";
}

/**
 * Process raw transactions and add categorization
 */
export function processTransactions(
  rawTransactions: RawTransaction[],
  rules: CategorizationRule[],
  statementType: "debit" | "credit" = "debit",
  options: ProcessTransactionsOptions = {}
): CategorizedTransaction[] {
  const merchantHints = buildMerchantHints(options.historicalTransactions || []);
  const currentStatementMerchantAssignments = new Map<string, string>();

  return rawTransactions.map((tx) => {
    const merchantInfo =
      statementType === "credit"
        ? { merchant: extractLikelyMerchant(tx.remarks) || normalize(tx.remarks), method: "CARD" as const }
        : extractMerchant(tx.remarks);

    const merchantKey = normalizeMerchantKey(merchantInfo.merchant);
    const sessionCategory = currentStatementMerchantAssignments.get(merchantKey);
    const categoryId =
      sessionCategory ||
      categorizeTransaction(
        {
          remarks: tx.remarks,
          merchantName: merchantInfo.merchant,
          withdrawalAmount: tx.withdrawalAmount,
          depositAmount: tx.depositAmount,
        },
        rules,
        { merchantHints }
      );

    if (merchantKey && categoryId !== "uncategorized") {
      currentStatementMerchantAssignments.set(merchantKey, categoryId);
    }

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
      statementType,
      rewardPoints: tx.rewardPoints,
      categoryId,
    };

    return categorized;
  });
}
