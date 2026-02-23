import {
  readWorkbook,
  getSheetData,
  parseIndianDate,
  parseAmount,
  computeFileHash,
  type RawTransaction,
  type ParsedStatement,
} from "./xlsParser";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function isValidDate(date: Date | null | undefined): date is Date {
  return !!date && !Number.isNaN(date.getTime());
}

function compactLineForMatching(line: string): string {
  return line.toLowerCase().replace(/\s+/g, "");
}

function parseSpacedMonthDate(raw: string): Date | null {
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(
    /(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|October|Oct|November|Nov|December|Dec)(\d{1,2}),(\d{4})/i
  );
  if (!match) return null;

  const normalized = `${match[1]} ${match[2]}, ${match[3]}`;
  const parsed = new Date(normalized);
  return isValidDate(parsed) ? parsed : null;
}

function resolveStatementDateRange(
  periodFrom: Date | null,
  periodTo: Date | null,
  transactions: RawTransaction[]
): { dateFrom: Date; dateTo: Date } {
  const txTimes = transactions
    .map((tx) => tx.transactionDate?.getTime())
    .filter((time): time is number => typeof time === "number" && Number.isFinite(time));

  const now = new Date();
  if (txTimes.length === 0) {
    const dateFrom = isValidDate(periodFrom) ? periodFrom : now;
    const dateTo = isValidDate(periodTo) ? periodTo : dateFrom;
    return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
  }

  const minTxDate = new Date(Math.min(...txTimes));
  const maxTxDate = new Date(Math.max(...txTimes));
  const thresholdMs = 120 * 24 * 60 * 60 * 1000;

  let dateFrom = isValidDate(periodFrom) ? periodFrom : minTxDate;
  let dateTo = isValidDate(periodTo) ? periodTo : maxTxDate;

  if (Math.abs(dateFrom.getTime() - minTxDate.getTime()) > thresholdMs) {
    dateFrom = minTxDate;
  }
  if (Math.abs(dateTo.getTime() - maxTxDate.getTime()) > thresholdMs) {
    dateTo = maxTxDate;
  }

  if (dateFrom > dateTo) {
    return { dateFrom: minTxDate, dateTo: maxTxDate };
  }

  return { dateFrom, dateTo };
}

function extractDateAtStart(line: string): { dateText: string; restText: string } | null {
  const match = line.match(
    /^\s*((?:\d\s*){2}\s*[-/]\s*(?:\d\s*){2}\s*[-/]\s*(?:\d\s*){2,4})\b/
  );
  if (!match) return null;

  const normalizedDate = match[1].replace(/\s+/g, "");

  return {
    dateText: normalizedDate,
    restText: line.slice(match[0].length).trim(),
  };
}

function extractTrailingNumericAmounts(line: string): {
  amountTexts: string[];
  leadingText: string;
} | null {
  const normalizedLine = line
    .replace(/(?<=\d)\s+(?=[\d,.-])/g, "")
    .replace(/(?<=[,.-])\s+(?=\d)/g, "");

  const matches = Array.from(normalizedLine.matchAll(/-?\(?\d[\d,]*\.\d{2}\)?/g));
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  if (lastMatch.index === undefined) return null;

  const contiguous: Array<{ value: string; index: number }> = [
    { value: lastMatch[0], index: lastMatch.index },
  ];
  let currentStart = lastMatch.index;
  for (let i = matches.length - 2; i >= 0; i--) {
    const match = matches[i];
    if (match.index === undefined) continue;
    const gap = normalizedLine.slice(match.index + match[0].length, currentStart);
    if (!/^\s*(?:CR|DR)?\s*$/i.test(gap)) {
      break;
    }
    contiguous.unshift({ value: match[0], index: match.index });
    currentStart = match.index;
  }

  if (contiguous.length === 0) return null;

  const selected = contiguous.length > 3 ? contiguous.slice(contiguous.length - 3) : contiguous;
  const firstIndex = selected[0].index;

  return {
    amountTexts: selected.map((entry) => entry.value),
    leadingText: normalizedLine.slice(0, firstIndex).trim(),
  };
}

function parseNoisyAmount(value: string): number {
  const trimmed = value.trim();
  const isNegativeByParens = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()]/g, "").replace(/[^\d,.-]/g, "");
  const parsed = parseAmount(cleaned);
  return isNegativeByParens ? -parsed : parsed;
}

function almostEqualAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function isDebitPdfNarrationLine(line: string): boolean {
  const compact = compactLineForMatching(line);

  if (
    compact.startsWith("total") ||
    compact.startsWith("subtotal") ||
    compact.startsWith("grandtotal") ||
    compact.startsWith("openingbalance") ||
    compact.startsWith("closingbalance") ||
    compact.startsWith("datemodeparticularsdepositswithdrawalsbalance") ||
    compact.startsWith("accountrelatedotherinformation")
  ) {
    return false;
  }

  if (!/[A-Za-z]/.test(line) && !/[/-]/.test(line)) {
    return false;
  }

  return true;
}

function isDebitPdfTransactionHeaderLine(compact: string): boolean {
  if (!compact.includes("date")) return false;
  if (!compact.includes("balance")) return false;

  const hasCoreColumns =
    compact.includes("withdraw") ||
    compact.includes("deposit") ||
    compact.includes("particular") ||
    compact.includes("remarks");

  return hasCoreColumns;
}

function isLikelyNextDebitTransactionPrelude(line: string): boolean {
  const compact = compactLineForMatching(line);
  if (!compact || compact.length < 3) return false;

  if (
    compact.startsWith("upi/") ||
    compact.startsWith("neft") ||
    compact.startsWith("mmt") ||
    compact.startsWith("imps") ||
    compact.startsWith("netbanking") ||
    compact.startsWith("bil/") ||
    compact.startsWith("cashwithdrawal") ||
    compact.startsWith("pos/") ||
    compact.startsWith("vps/") ||
    compact.startsWith("atw/")
  ) {
    return true;
  }

  return false;
}

function blockHasParseableAmount(block: DebitPdfTransactionBlock): boolean {
  const dateInfo = extractDateAtStart(block.dateLine);
  if (!dateInfo) return false;

  const blockBody = [dateInfo.restText, ...block.trailingLines]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const amountInfo = extractTrailingNumericAmounts(blockBody);
  return !!amountInfo && amountInfo.amountTexts.length >= 2;
}

function cleanDebitParticularSegment(
  segment: string,
  index: 0 | 1 | 2
): string {
  const trimmed = segment.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  if (index === 0) {
    return trimmed.replace(/\s+/g, "");
  }

  if (index === 2) {
    return trimmed.replace(/\s+/g, "");
  }

  const suffixTokens = new Set(["co", "ltd", "pvt", "llp", "inc", "bank", "mart"]);
  const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);

  let i = 0;
  while (i < tokens.length - 1) {
    const current = tokens[i];
    const next = tokens[i + 1];
    const currentIsAlpha = /^[A-Za-z]+$/.test(current);
    const nextIsAlpha = /^[A-Za-z]+$/.test(next);

    if (!currentIsAlpha || !nextIsAlpha) {
      i += 1;
      continue;
    }

    const nextLower = next.toLowerCase();
    const shouldJoin =
      current.length === 1 ||
      next.length === 1 ||
      (current.length >= 3 && next.length <= 2 && !suffixTokens.has(nextLower));

    if (shouldJoin) {
      tokens[i] = `${current}${next}`;
      tokens.splice(i + 1, 1);
      continue;
    }

    i += 1;
  }

  return tokens
    .join(" ")
    .replace(/\s+([.,@_-])/g, "$1")
    .replace(/([.,@_-])\s+/g, "$1")
    .trim();
}

function summarizeDebitParticulars(rawRemarks: string): string {
  const normalized = rawRemarks.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim();
  if (!normalized) return "Transaction";
  if (/^B\/F$/i.test(normalized) || /\bB\/F\b/i.test(normalized)) {
    return "B/F";
  }

  if (!normalized.includes("/")) {
    return normalized;
  }

  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length >= 3) {
    const first = cleanDebitParticularSegment(segments[0], 0);
    const second = cleanDebitParticularSegment(segments[1], 1);
    const third = cleanDebitParticularSegment(segments[2], 2);
    return `${first}/${second}/${third}`;
  }

  return segments.join("/") || normalized;
}

function mapPdfParseError(error: unknown): Error {
  if (error instanceof Error) {
    if (
      error.name === "PasswordException" ||
      error.name === "NEED_PASSWORD" ||
      /password/i.test(error.message)
    ) {
      return new Error(
        "This PDF is password-protected. Please upload an unprotected statement PDF."
      );
    }
    return error;
  }
  return new Error("Unable to read this PDF statement.");
}

/**
 * Parse ICICI Bank statement XLS file
 */
export async function parseICICIStatement(
  file: File,
  statementType: "debit" | "credit" = "debit"
): Promise<ParsedStatement> {
  if (statementType === "credit") {
    return parseICICICreditPdfStatement(file);
  }

  return parseICICIDebitStatement(file);
}

async function parseICICIDebitStatement(file: File): Promise<ParsedStatement> {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    return parseICICIDebitPdfStatement(file);
  }

  const workbook = await readWorkbook(file);
  const data = getSheetData(workbook);

  console.log("Sheet data rows:", data.length);

  // Find metadata
  let accountNumber = "";
  let accountHolder = "";
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;

  // Find header row and parse metadata
  let headerRowIndex = -1;
  let columnOffset = 0; // Handle sheets with empty first column

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;

    const rowStr = row.join(" ").toLowerCase();

    // Look for account info
    if (rowStr.includes("account number")) {
      const fullRow = row.join(" ");
      // Extract account number - look for digits
      const accountMatch = fullRow.match(/(\d{10,})/);
      if (accountMatch) {
        accountNumber = accountMatch[1];
      }
      // Extract account holder name
      const holderMatch = fullRow.match(/-\s*([A-Z][A-Z\s]+)$/i);
      if (holderMatch) {
        accountHolder = holderMatch[1].trim();
      }
    }

    // Look for date range
    if (rowStr.includes("from") && rowStr.includes("to")) {
      const fullRow = row.join(" ");
      const dateMatch = fullRow.match(
        /(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/i
      );
      if (dateMatch) {
        dateFrom = parseIndianDate(dateMatch[1]);
        dateTo = parseIndianDate(dateMatch[2]);
      }
    }

    // Find header row - look for "S No" column
    if (rowStr.includes("s no")) {
      console.log("Found header row at index", i, ":", row);
      headerRowIndex = i;

      // Determine column offset (check if first column is empty/null)
      columnOffset = (row[0] === null || row[0] === undefined || row[0] === "") ? 1 : 0;
      console.log("Column offset:", columnOffset);
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error("Could not find header row");
    throw new Error("Could not find transaction header row in the statement");
  }

  // Parse transactions starting after header row
  const transactions: RawTransaction[] = [];

  console.log("Starting to parse transactions from row", headerRowIndex + 1);

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;
    if (row.length < 6) continue;

    // Apply column offset
    const serialNoVal = row[0 + columnOffset];
    const serialNo = parseAmount(serialNoVal);

    // Check if this is a valid transaction row (starts with a serial number)
    if (serialNo <= 0 || !Number.isInteger(serialNo)) continue;

    // Skip if we hit the "Legends" section
    const remarksCell = String(row[5 + columnOffset] || "").toLowerCase();
    if (remarksCell.includes("legend") || remarksCell.includes("note")) break;

    const transaction: RawTransaction = {
      serialNo,
      valueDate: parseIndianDate(String(row[1 + columnOffset] || "")),
      transactionDate: parseIndianDate(String(row[2 + columnOffset] || "")),
      chequeNumber: row[3 + columnOffset] ? String(row[3 + columnOffset]) : undefined,
      remarks: String(row[4 + columnOffset] || ""),
      withdrawalAmount: parseAmount(row[5 + columnOffset]),
      depositAmount: parseAmount(row[6 + columnOffset]),
      balance: parseAmount(row[7 + columnOffset]),
    };

    console.log("Parsed transaction:", transaction.serialNo, transaction.remarks.slice(0, 30));

    // Only add if we have valid data
    if (
      transaction.remarks &&
      (transaction.withdrawalAmount > 0 || transaction.depositAmount > 0 || transaction.balance > 0)
    ) {
      transactions.push(transaction);
    }
  }

  console.log("Total transactions parsed:", transactions.length);
  if (transactions.length === 0) {
    throw new Error(
      "No transactions were found in this debit statement. Please verify the file format."
    );
  }

  // Compute file hash
  const fileHash = await computeFileHash(file);
  const { dateFrom: resolvedDateFrom, dateTo: resolvedDateTo } =
    resolveStatementDateRange(dateFrom, dateTo, transactions);

  return {
    statementType: "debit",
    accountNumber,
    accountHolder,
    dateFrom: resolvedDateFrom,
    dateTo: resolvedDateTo,
    transactions,
    fileHash,
  };
}

interface DebitPdfTransactionBlock {
  preludeLines: string[];
  dateLine: string;
  trailingLines: string[];
}

async function parseICICIDebitPdfStatement(file: File): Promise<ParsedStatement> {
  const rawLines = await extractPdfLines(file);
  const lines = rawLines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
  const text = lines.join("\n");
  const fileHash = await computeFileHash(file);

  const accountHolderLine = lines.find((line) =>
    compactLineForMatching(line).includes("accountholders:")
  );
  const accountHolder =
    accountHolderLine && accountHolderLine.includes(":")
      ? accountHolderLine
          .slice(accountHolderLine.indexOf(":") + 1)
          .replace(/\s+/g, " ")
          .trim()
      : "";

  const accountLine =
    lines.find((line) => {
      const compact = compactLineForMatching(line);
      return compact.includes("savingsa/c") || compact.includes("savingsaccount");
    }) || "";
  const compactAccountLine = accountLine.replace(/\s+/g, "");
  const accountNumberMatch = compactAccountLine.match(
    /(?:SavingsA\/c|SavingsAccount)([X*\d]{8,})/i
  );
  const accountNumber = accountNumberMatch?.[1] || "";

  const currencyMatch = text.replace(/\s+/g, "").match(/ACCOUNTDETAILS-([A-Z]{3})/i);
  const currency = currencyMatch?.[1]?.toUpperCase();

  let periodFrom: Date | null = null;
  let periodTo: Date | null = null;
  const periodLine =
    lines.find((line) => {
      const compact = compactLineForMatching(line);
      return compact.includes("fortheperiod") && compact.includes("savingsaccount");
    }) || "";
  if (periodLine) {
    const compactPeriodLine = periodLine.replace(/\s+/g, "");
    const periodMatch = compactPeriodLine.match(/fortheperiod(.+?)-(.+)$/i);
    if (periodMatch) {
      periodFrom = parseSpacedMonthDate(periodMatch[1]);
      periodTo = parseSpacedMonthDate(periodMatch[2]);
    }
  }

  const transactions: RawTransaction[] = [];
  let serialNo = 1;
  let previousBalance: number | undefined;
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  const totalBalanceLines: number[] = [];

  let inTransactionSection = false;
  let pendingPrelude: string[] = [];
  let currentBlock: DebitPdfTransactionBlock | null = null;

  const finalizeCurrentBlock = () => {
    if (!currentBlock) return;

    const parsed = parseDebitPdfTransactionBlock(currentBlock);
    currentBlock = null;
    if (!parsed) return;

    if (parsed.isOpeningRow) {
      openingBalance = openingBalance ?? parsed.balance;
      previousBalance = parsed.balance;
      return;
    }

    let { depositAmount, withdrawalAmount } = parsed;
    const balanceDelta =
      previousBalance !== undefined ? parsed.balance - previousBalance : undefined;

    if (
      previousBalance !== undefined &&
      depositAmount !== undefined &&
      withdrawalAmount !== undefined
    ) {
      const expectedBalance = previousBalance + depositAmount - withdrawalAmount;
      if (!almostEqualAmount(expectedBalance, parsed.balance)) {
        const swappedExpected = previousBalance + withdrawalAmount - depositAmount;
        if (almostEqualAmount(swappedExpected, parsed.balance)) {
          [depositAmount, withdrawalAmount] = [withdrawalAmount, depositAmount];
        } else if (typeof balanceDelta === "number" && Math.abs(balanceDelta) > 0.01) {
          if (balanceDelta > 0) {
            depositAmount = Math.abs(balanceDelta);
            withdrawalAmount = 0;
          } else {
            depositAmount = 0;
            withdrawalAmount = Math.abs(balanceDelta);
          }
        }
      }
    }

    let singleAmount = parsed.amount;
    if (
      typeof balanceDelta === "number" &&
      singleAmount !== undefined &&
      Math.abs(balanceDelta) > 0.01 &&
      !almostEqualAmount(Math.abs(balanceDelta), Math.abs(singleAmount))
    ) {
      singleAmount = Math.abs(balanceDelta);
    }

    if (
      depositAmount === undefined &&
      withdrawalAmount === undefined &&
      singleAmount !== undefined
    ) {
      if (typeof balanceDelta === "number" && balanceDelta > 0) {
        depositAmount = singleAmount;
        withdrawalAmount = 0;
      } else if (typeof balanceDelta === "number" && balanceDelta < 0) {
        withdrawalAmount = singleAmount;
        depositAmount = 0;
      } else if (previousBalance !== undefined && parsed.balance >= previousBalance) {
        depositAmount = singleAmount;
        withdrawalAmount = 0;
      } else {
        withdrawalAmount = singleAmount;
        depositAmount = 0;
      }
    }

    const deposit = depositAmount ?? 0;
    const withdrawal = withdrawalAmount ?? 0;
    if (deposit === 0 && withdrawal === 0) return;

    if (openingBalance === undefined) {
      openingBalance = parsed.balance - deposit + withdrawal;
    }

    transactions.push({
      serialNo: serialNo++,
      valueDate: parsed.date,
      transactionDate: parsed.date,
      chequeNumber: undefined,
      remarks: parsed.remarks,
      withdrawalAmount: withdrawal,
      depositAmount: deposit,
      balance: parsed.balance,
    });
    previousBalance = parsed.balance;
  };

  for (const line of lines) {
    const compact = compactLineForMatching(line);

    if (
      compact.includes("datemodeparticularsdepositswithdrawalsbalance") ||
      isDebitPdfTransactionHeaderLine(compact)
    ) {
      inTransactionSection = true;
      pendingPrelude = [];
      continue;
    }

    if (!inTransactionSection) {
      const dateStart = extractDateAtStart(line);
      if (dateStart) {
        inTransactionSection = true;
        currentBlock = {
          preludeLines: [...pendingPrelude],
          dateLine: line,
          trailingLines: [],
        };
        pendingPrelude = [];
        continue;
      }

      if (/[A-Za-z]/.test(line)) {
        pendingPrelude.push(line);
        if (pendingPrelude.length > 2) {
          pendingPrelude.shift();
        }
      }
      continue;
    }

    if (compact.startsWith("accountrelatedotherinformation")) {
      finalizeCurrentBlock();
      break;
    }

    if (
      compact.startsWith("page") ||
      /^--\d+of\d+--$/.test(compact) ||
      compact.includes("statementoftransactionsinsavingsaccount")
    ) {
      continue;
    }

    if (/^total\s*:?/i.test(line)) {
      const trailing = extractTrailingNumericAmounts(line);
      if (trailing) {
        const totalBalance = parseNoisyAmount(
          trailing.amountTexts[trailing.amountTexts.length - 1]
        );
        if (totalBalance > 0) {
          totalBalanceLines.push(totalBalance);
        }
      }
      continue;
    }

    const dateStart = extractDateAtStart(line);
    if (dateStart) {
      finalizeCurrentBlock();
      currentBlock = {
        preludeLines: [...pendingPrelude],
        dateLine: line,
        trailingLines: [],
      };
      pendingPrelude = [];
      continue;
    }

    if (currentBlock) {
      if (
        isLikelyNextDebitTransactionPrelude(line) &&
        blockHasParseableAmount(currentBlock)
      ) {
        pendingPrelude.push(line);
        if (pendingPrelude.length > 2) {
          pendingPrelude.shift();
        }
        continue;
      }

      if (isDebitPdfNarrationLine(line)) {
        currentBlock.trailingLines.push(line);
      }
    } else if (/[A-Za-z]/.test(line)) {
      pendingPrelude.push(line);
      if (pendingPrelude.length > 2) {
        pendingPrelude.shift();
      }
    }
  }

  finalizeCurrentBlock();

  if (transactions.length === 0) {
    throw new Error(
      "No transactions were found in this debit PDF. Please verify the statement PDF is complete."
    );
  }

  if (totalBalanceLines.length > 0) {
    closingBalance = totalBalanceLines[totalBalanceLines.length - 1];
  } else if (previousBalance !== undefined) {
    closingBalance = previousBalance;
  }

  if (openingBalance === undefined && transactions.length > 0) {
    const firstTransaction = transactions[0];
    openingBalance =
      firstTransaction.balance -
      firstTransaction.depositAmount +
      firstTransaction.withdrawalAmount;
  }

  const { dateFrom, dateTo } = resolveStatementDateRange(
    periodFrom,
    periodTo,
    transactions
  );

  return {
    statementType: "debit",
    accountNumber,
    accountHolder,
    dateFrom,
    dateTo,
    transactions,
    fileHash,
    openingBalance,
    closingBalance,
    currency,
  };
}

async function parseICICICreditPdfStatement(file: File): Promise<ParsedStatement> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Credit statement import expects a PDF file");
  }

  const lines = await extractPdfLines(file, { maxPages: 2 });
  const text = lines.join("\n");
  const transactionLines = collectCreditTransactionLines(lines);
  const transactions = transactionLines
    .map((line, index) => parseCreditTransactionLine(line, index + 1))
    .filter((tx): tx is RawTransaction => tx !== null);
  if (transactions.length === 0) {
    throw new Error(
      "No transactions were found in this credit PDF. Please verify the statement PDF is complete."
    );
  }

  const fileHash = await computeFileHash(file);
  const periodMatch = text.match(
    /Statement period\s*:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
  );

  const accountNumberMatch = text.match(/\b\d{4}X{4,}\d{4}\b/);
  const accountHolderMatch = lines.find((line) =>
    /^(MR|MS|MRS)\s+[A-Z\s]+$/i.test(line.trim())
  );
  const cashback = parseCashbackSummary(text);
  const periodFrom = periodMatch ? new Date(periodMatch[1]) : null;
  const periodTo = periodMatch ? new Date(periodMatch[2]) : null;
  const { dateFrom, dateTo } = resolveStatementDateRange(
    isValidDate(periodFrom) ? periodFrom : null,
    isValidDate(periodTo) ? periodTo : null,
    transactions
  );

  return {
    statementType: "credit",
    accountNumber: accountNumberMatch?.[0] || "Credit Card",
    accountHolder: accountHolderMatch?.trim() || "Credit Card Holder",
    dateFrom,
    dateTo,
    transactions,
    fileHash,
    cashbackEarned: cashback.earned,
    cashbackTransferred: cashback.transferred,
  };
}

async function extractPdfLines(
  file: File,
  options: { maxPages?: number } = {}
): Promise<string[]> {
  try {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const lines: string[] = [];
    const requestedMaxPages = options.maxPages;
    const pageLimit =
      typeof requestedMaxPages === "number" && Number.isFinite(requestedMaxPages)
        ? Math.max(1, Math.min(pdf.numPages, Math.floor(requestedMaxPages)))
        : pdf.numPages;

    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = (textContent.items as any[]).filter(
        (item) => item.str && String(item.str).trim()
      );

      const byY = new Map<number, { x: number; str: string }[]>();
      for (const item of items) {
        const x = item.transform[4];
        const y = Math.round(item.transform[5]);
        if (!byY.has(y)) {
          byY.set(y, []);
        }
        byY.get(y)!.push({ x, str: String(item.str).trim() });
      }

      const pageLines = Array.from(byY.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, entries]) =>
          entries
            .sort((a, b) => a.x - b.x)
            .map((entry) => entry.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean);

      lines.push(...pageLines);
    }

    return lines;
  } catch (error) {
    throw mapPdfParseError(error);
  }
}

function collectCreditTransactionLines(lines: string[]): string[] {
  const transactionLines: string[] = [];
  let current = "";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (
      line.startsWith("Date SerNo.") ||
      line.startsWith("Page ") ||
      /^-- \d+ of \d+ --$/.test(line)
    ) {
      continue;
    }

    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{8,}/.test(line)) {
      if (current) {
        transactionLines.push(current.trim());
      }
      current = line;
      continue;
    }

    if (!current) continue;
    if (
      /^Credit Limit|^# International Spends|^ICICI Bank Credit Card GST|^EARNINGS\b|^IMPORTANT\b|^For any query\b|^Our registered office\b/i.test(
        line
      )
    ) {
      transactionLines.push(current.trim());
      current = "";
      continue;
    }

    current += ` ${line}`;
  }

  if (current) {
    transactionLines.push(current.trim());
  }

  return transactionLines;
}

function sanitizeCreditTransactionTail(tailRaw: string): string {
  const tail = tailRaw.replace(/\s+/g, " ").trim();
  if (!tail) return "";

  if (
    /^# International Spends\b|^Credit Limit\b|^ICICI Bank Credit Card GST\b|^EARNINGS\b|^IMPORTANT\b|^For any query\b|^Our registered office\b|^Safe Banking Tips\b|^Please pay your Credit Card\b/i.test(
      tail
    )
  ) {
    return "";
  }

  if (
    tail.length > 140 &&
    /EARNINGS|IMPORTANT|registered office|Safe Banking|payment due date/i.test(tail)
  ) {
    return "";
  }

  return tail;
}

function parseCreditTransactionLine(line: string, fallbackSerial: number): RawTransaction | null {
  const normalizedLine = line.replace(/\s+/g, " ").trim();
  const match = normalizedLine.match(
    /^(\d{2}\/\d{2}\/\d{4})\s+(\d{8,})\s+(.+)\s+(\d+)\s+(?:(\d+(?:\.\d+)?)\s+([A-Z]{3})\s+)?(\d[\d,]*\.\d{2})(?:\s+(CR))?(?:\s+(.*))?$/i
  );
  if (!match) return null;

  const dateToken = match[1];
  const serialToken = match[2];
  const remarksRaw = match[3];
  const rewardPointsToken = match[4];
  const amountToken = match[7];
  const trailingDetailsToken = match[9];

  const serialNo = Number.parseInt(serialToken, 10) || fallbackSerial;
  const rewardPoints = Number.parseInt(rewardPointsToken, 10) || 0;
  const amount = Number.parseFloat(amountToken.replace(/,/g, ""));
  const trailingDetails = trailingDetailsToken
    ? sanitizeCreditTransactionTail(trailingDetailsToken)
    : "";
  const remarks = [remarksRaw.trim(), trailingDetails].filter(Boolean).join(" ").trim();
  const date = parseIndianDate(dateToken);
  const isCredit = /\sCR(?:\s|$)/i.test(normalizedLine);

  if (!remarks || !Number.isFinite(amount)) return null;

  return {
    serialNo,
    valueDate: date,
    transactionDate: date,
    remarks,
    withdrawalAmount: isCredit ? 0 : amount,
    depositAmount: isCredit ? amount : 0,
    balance: 0,
    rewardPoints,
  };
}

function parseCashbackSummary(text: string): {
  earned?: number;
  transferred?: number;
} {
  const compact = text.replace(/\s+/g, " ");
  const sectionMatch = compact.match(/EARNINGS([\s\S]{0,260})SPENDS OVERVIEW/i);
  const target = sectionMatch ? sectionMatch[1] : compact;
  const numbers = target.match(/\b\d[\d,]*\b/g) || [];

  if (numbers.length < 2) {
    return {};
  }

  const earnedRaw = numbers[0];
  const transferredRaw = numbers[1];
  if (!earnedRaw || !transferredRaw) {
    return {};
  }

  const earned = Number.parseInt(earnedRaw.replace(/,/g, ""), 10);
  const transferred = Number.parseInt(transferredRaw.replace(/,/g, ""), 10);

  return {
    earned: Number.isFinite(earned) && earned >= 0 ? earned : undefined,
    transferred:
      Number.isFinite(transferred) && transferred >= 0 ? transferred : undefined,
  };
}

function parseDebitPdfTransactionBlock(block: DebitPdfTransactionBlock): {
  date: Date;
  remarks: string;
  balance: number;
  amount?: number;
  depositAmount?: number;
  withdrawalAmount?: number;
  isOpeningRow: boolean;
} | null {
  const dateInfo = extractDateAtStart(block.dateLine);
  if (!dateInfo) return null;

  const blockBody = [dateInfo.restText, ...block.trailingLines]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const amountInfo = extractTrailingNumericAmounts(blockBody);
  if (!amountInfo) return null;

  const amountTexts = amountInfo.amountTexts;
  const balance = parseNoisyAmount(amountTexts[amountTexts.length - 1]);
  if (!Number.isFinite(balance)) return null;

  const inlineRemarks = amountInfo.leadingText;
  const remarkParts = [...block.preludeLines, inlineRemarks].filter(
    (part) => part && part.trim().length > 0
  );
  const rawRemarks = remarkParts.join(" ").replace(/\s+/g, " ").trim() || "Transaction";
  const isOpeningRow = /^B\/F$/i.test(rawRemarks) || /\bB\/F\b/i.test(rawRemarks);
  const remarks = summarizeDebitParticulars(rawRemarks);
  const date = parseDashedIndianDate(dateInfo.dateText);

  if (amountTexts.length >= 3) {
    return {
      date,
      remarks,
      balance,
      depositAmount: parseNoisyAmount(amountTexts[amountTexts.length - 3]),
      withdrawalAmount: parseNoisyAmount(amountTexts[amountTexts.length - 2]),
      isOpeningRow,
    };
  }

  if (amountTexts.length >= 2) {
    return {
      date,
      remarks,
      balance,
      amount: parseNoisyAmount(amountTexts[amountTexts.length - 2]),
      isOpeningRow,
    };
  }

  if (isOpeningRow) {
    return {
      date,
      remarks,
      balance,
      isOpeningRow: true,
    };
  }

  return null;
}

function parseDashedIndianDate(dateStr: string): Date {
  const parts = dateStr.trim().split("-");
  if (parts.length === 3) {
    const day = Number.parseInt(parts[0], 10);
    const month = Number.parseInt(parts[1], 10) - 1;
    const year = Number.parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

/**
 * Detect if a file is an ICICI Bank statement
 */
export async function isICICIStatement(file: File): Promise<boolean> {
  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const lines = await extractPdfLines(file);
      const preview = lines.slice(0, 40).join(" ").toLowerCase();
      const isCredit = preview.includes("credit card statement");
      const isDebit =
        preview.includes("statement of transactions in savings account") ||
        preview.includes("account details - inr");
      return preview.includes("icici") && (isCredit || isDebit);
    }

    const workbook = await readWorkbook(file);
    const data = getSheetData(workbook);

    // Look for ICICI-specific markers
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      const rowStr = row.join(" ").toLowerCase();
      if (
        rowStr.includes("icici") ||
        rowStr.includes("finacle") ||
        rowStr.includes("detailed statement")
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
