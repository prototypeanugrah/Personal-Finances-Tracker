import {
  readWorkbook,
  getSheetData,
  parseIndianDate,
  parseAmount,
  computeFileHash,
  type RawTransaction,
  type ParsedStatement,
} from "./xlsParser";

/**
 * Parse ICICI Bank statement XLS file
 */
export async function parseICICIStatement(
  file: File
): Promise<ParsedStatement> {
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

  // Compute file hash
  const fileHash = await computeFileHash(file);

  return {
    accountNumber,
    accountHolder,
    dateFrom: dateFrom || new Date(),
    dateTo: dateTo || new Date(),
    transactions,
    fileHash,
  };
}

/**
 * Detect if a file is an ICICI Bank statement
 */
export async function isICICIStatement(file: File): Promise<boolean> {
  try {
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
