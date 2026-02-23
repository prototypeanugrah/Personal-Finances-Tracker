import * as XLSX from "xlsx";

export interface RawTransaction {
  serialNo: number;
  valueDate: Date;
  transactionDate: Date;
  chequeNumber?: string;
  remarks: string;
  withdrawalAmount: number;
  depositAmount: number;
  balance: number;
  rewardPoints?: number;
}

export interface ParsedStatement {
  statementType: "debit" | "credit";
  accountNumber: string;
  accountHolder: string;
  dateFrom: Date;
  dateTo: Date;
  transactions: RawTransaction[];
  fileHash: string;
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
  cashbackEarned?: number;
  cashbackTransferred?: number;
}

/**
 * Compute a simple hash of the file content for deduplication
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Read an XLS/XLSX file and return the workbook
 */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

/**
 * Parse Indian date format DD/MM/YYYY to Date object
 */
export function parseIndianDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Handle DD/MM/YYYY format
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  // Fallback to standard parsing
  return new Date(dateStr);
}

/**
 * Parse a numeric value, handling Indian number formatting
 */
export function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const str = String(value).replace(/,/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Get sheet data as 2D array
 */
export function getSheetData(workbook: XLSX.WorkBook): unknown[][] {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}
