import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { FileDropZone } from "./components/FileManager/FileDropZone";
import { StatementList } from "./components/FileManager/StatementList";
import { TransactionTable } from "./components/Transactions/TransactionTable";
import { getMonthKey } from "./components/Dashboard/MonthSelector";
import type { ParsedStatement } from "./lib/parser/xlsParser";
import { processTransactions } from "./lib/categorizer/categoryEngine";
import { defaultRules } from "./lib/categorizer/defaultRules";
import type {
  CategorizedTransaction,
  HistoricalCategorizedTransaction,
} from "./lib/categorizer/categoryEngine";
import "./styles/globals.css";
import "./App.css";

type View = "dashboard" | "transactions" | "import";

type ImportStatementPayload = {
  statement: Record<string, unknown>;
  transactions: Record<string, unknown>[];
};

function getConvexValidationIssue(error: unknown): {
  field: string;
  path: string;
} | null {
  if (!(error instanceof Error)) return null;
  if (!error.message.includes("ArgumentValidationError")) return null;

  const fieldMatch = error.message.match(/extra field `([^`]+)`/i);
  const pathMatch = error.message.match(/Path:\s*([^\n]+)/i);
  const field = fieldMatch?.[1];
  const path = pathMatch?.[1]?.trim();
  if (!field || !path) return null;

  return { field, path };
}

function removeRejectedField(
  payload: ImportStatementPayload,
  field: string,
  path: string
): ImportStatementPayload | null {
  const next: ImportStatementPayload = {
    statement: { ...payload.statement },
    transactions: payload.transactions.map((tx) => ({ ...tx })),
  };

  let removed = false;
  if (path.includes(".statement")) {
    if (field in next.statement) {
      delete next.statement[field];
      removed = true;
    }
  } else if (path.includes(".transactions")) {
    for (const tx of next.transactions) {
      if (field in tx) {
        delete tx[field];
        removed = true;
      }
    }
  }

  return removed ? next : null;
}

function App() {
  const [view, setView] = useState<View>("import");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecategorizing, setIsRecategorizing] = useState(false);

  // Convex queries
  const statementsRaw = useQuery(api.statements.list);
  const transactionsRaw = useQuery(api.transactions.list, {});
  const statements = statementsRaw ?? [];
  const transactions = transactionsRaw ?? [];

  // Convex mutations
  const importStatement = useMutation(api.statements.importStatement);
  const removeStatement = useMutation(api.statements.remove);
  const updateCategory = useMutation(api.transactions.updateCategory);
  const batchUpdateCategoryIds = useMutation(api.transactions.batchUpdateCategoryIds);

  const importStatementWithCompatibility = useCallback(
    async (initialPayload: ImportStatementPayload) => {
      let payload = initialPayload;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          return await importStatement(payload as any);
        } catch (error) {
          const issue = getConvexValidationIssue(error);
          if (!issue) {
            throw error;
          }

          const nextPayload = removeRejectedField(payload, issue.field, issue.path);
          if (!nextPayload) {
            throw error;
          }

          payload = nextPayload;
        }
      }

      throw new Error(
        "Import failed due to backend schema mismatch. Please run `npx convex dev` and retry."
      );
    },
    [importStatement]
  );

  // Auto-navigate to dashboard if we have data
  useEffect(() => {
    if (transactions.length > 0 && view === "import") {
      setView("dashboard");
    }
  }, [transactions.length]);

  const handleStatementParsed = useCallback(
    async (statement: ParsedStatement, categorizedTransactions: CategorizedTransaction[]) => {
      setIsLoading(true);

      try {
        // Create filename from date range
        const dateFrom = statement.dateFrom;
        const monthName = dateFrom.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        // Prepare statement data
        const statementData = {
          filename: `${monthName} ${statement.statementType === "credit" ? "Credit" : "Debit"} Statement`,
          statementType: statement.statementType,
          accountNumber: statement.accountNumber,
          accountHolder: statement.accountHolder,
          openingBalance: statement.openingBalance,
          closingBalance: statement.closingBalance,
          currency: statement.currency,
          dateFrom: statement.dateFrom.getTime(),
          dateTo: statement.dateTo.getTime(),
          transactionCount: categorizedTransactions.length,
          fileHash: statement.fileHash,
          cashbackEarned: statement.cashbackEarned,
          cashbackTransferred: statement.cashbackTransferred,
        };

        // Prepare transaction data
        const transactionData = categorizedTransactions.map((tx) => ({
          serialNo: tx.serialNo,
          valueDate: tx.valueDate,
          transactionDate: tx.transactionDate,
          chequeNumber: tx.chequeNumber || undefined,
          remarks: tx.remarks,
          withdrawalAmount: tx.withdrawalAmount,
          depositAmount: tx.depositAmount,
          balance: tx.balance,
          categoryId: tx.categoryId,
          merchantName: tx.merchantName || undefined,
          paymentMethod: tx.paymentMethod,
          rewardPoints: tx.rewardPoints,
        }));

        // Import using the combined mutation
        const result = await importStatementWithCompatibility({
          statement: statementData,
          transactions: transactionData,
        });

        if (result.alreadyExists) {
          alert("This statement has already been imported.");
          return;
        }

        // Set selected month to the newly imported month
        const year = dateFrom.getFullYear();
        const month = String(dateFrom.getMonth() + 1).padStart(2, "0");
        setSelectedMonth(`${year}-${month}`);

        setView("dashboard");
      } catch (error) {
        console.error("Failed to import statement:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to import statement. Please try again.";
        alert(message);
      } finally {
        setIsLoading(false);
      }
    },
    [importStatementWithCompatibility]
  );

  const handleDeleteStatement = useCallback(async (id: string) => {
    try {
      await removeStatement({ id: id as any });
    } catch (error) {
      console.error("Failed to delete statement:", error);
      alert("Failed to delete statement. Please try again.");
    }
  }, [removeStatement]);

  const handleCategoryChange = useCallback(async (id: string, categoryId: string) => {
    try {
      await updateCategory({ id: id as any, categoryId });
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  }, [updateCategory]);

  const handleRecategorizeAll = useCallback(async () => {
    if (transactions.length === 0) return;

    const confirmed = window.confirm(
      "Re-categorize all existing transactions with smart tagging? Manual category overrides will be preserved."
    );
    if (!confirmed) return;

    setIsRecategorizing(true);

    try {
      const trainingSet: HistoricalCategorizedTransaction[] = transactions
        .filter((tx) => Boolean(tx.userCategoryOverride))
        .map((tx) => ({
          remarks: tx.remarks,
          merchantName: tx.merchantName,
          categoryId: tx.categoryId,
          userCategoryOverride: tx.userCategoryOverride,
          withdrawalAmount: tx.withdrawalAmount,
          depositAmount: tx.depositAmount,
        }));

      const statementGroups = new Map<string, (typeof transactions)[number][]>();
      for (const tx of transactions) {
        const statementKey = tx.statementId.toString();
        const group = statementGroups.get(statementKey);
        if (group) {
          group.push(tx);
        } else {
          statementGroups.set(statementKey, [tx]);
        }
      }

      const updates: { id: any; categoryId: string }[] = [];

      for (const group of statementGroups.values()) {
        const ordered = [...group].sort(
          (a, b) => a.transactionDate - b.transactionDate || a.serialNo - b.serialNo
        );

        const inferredStatementType: "debit" | "credit" = ordered.some(
          (tx) => tx.statementType === "credit" || (tx.rewardPoints || 0) > 0
        )
          ? "credit"
          : "debit";

        const recategorized = processTransactions(
          ordered.map((tx) => ({
            serialNo: tx.serialNo,
            valueDate: new Date(tx.valueDate),
            transactionDate: new Date(tx.transactionDate),
            chequeNumber: tx.chequeNumber,
            remarks: tx.remarks,
            withdrawalAmount: tx.withdrawalAmount,
            depositAmount: tx.depositAmount,
            balance: tx.balance,
            rewardPoints: tx.rewardPoints,
          })),
          defaultRules,
          inferredStatementType,
          { historicalTransactions: trainingSet }
        );

        for (let index = 0; index < ordered.length; index += 1) {
          const original = ordered[index];
          const nextCategoryId = recategorized[index]?.categoryId;

          if (!nextCategoryId) continue;
          if (original.userCategoryOverride) continue;
          if (nextCategoryId === original.categoryId) continue;

          updates.push({
            id: original._id,
            categoryId: nextCategoryId,
          });
        }
      }

      let updatedCount = 0;
      const batchSize = 200;
      for (let start = 0; start < updates.length; start += batchSize) {
        const chunk = updates.slice(start, start + batchSize);
        const result = await batchUpdateCategoryIds({ updates: chunk });
        updatedCount += result.updated;
      }

      alert(
        updates.length === 0
          ? "Re-categorization complete. No changes were needed."
          : `Re-categorization complete. Updated ${updatedCount} transactions.`
      );
    } catch (error) {
      console.error("Failed to re-categorize transactions:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to re-categorize transactions. Please try again.";
      alert(message);
    } finally {
      setIsRecategorizing(false);
    }
  }, [batchUpdateCategoryIds, transactions]);

  // Transform transactions to include _id as string for components
  const transformedTransactions = transactions.map((tx) => ({
    ...tx,
    _id: tx._id.toString(),
    statementId: tx.statementId.toString(),
  }));

  const transactionsForTable = useMemo(() => {
    if (!drilldownMonth) return transformedTransactions;
    return transformedTransactions.filter(
      (tx) => getMonthKey(tx.transactionDate) === drilldownMonth
    );
  }, [transformedTransactions, drilldownMonth]);

  // Transform statements for StatementList
  const transformedStatements = statements.map((s) => ({
    ...s,
    _id: s._id.toString(),
  }));

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-brand">
          <span className="nav-logo">💰</span>
          <span className="nav-title">Expense Tracker</span>
        </div>

        <div className="nav-links">
          <button
            className={`nav-link ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
            disabled={transactions.length === 0}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </button>

          <button
            className={`nav-link ${view === "transactions" ? "active" : ""}`}
            onClick={() => {
              setDrilldownCategory(null);
              setDrilldownMonth(null);
              setView("transactions");
            }}
            disabled={transactions.length === 0}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Transactions
          </button>

          <button
            className={`nav-link ${view === "import" ? "active" : ""}`}
            onClick={() => setView("import")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </button>
        </div>

        {transactions.length > 0 && (
          <div className="nav-stats">
            <span className="nav-stat">{transactions.length} transactions</span>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {view === "dashboard" && (
          <Dashboard
            transactions={transformedTransactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            onCategoryClick={(categoryId) => {
              setDrilldownCategory(categoryId);
              setDrilldownMonth(selectedMonth);
              setView("transactions");
            }}
          />
        )}

        {view === "transactions" && (
          <div className="transactions-view">
            <div className="transactions-view-header">
              <h1>Transactions</h1>
              <button
                className="btn-secondary transactions-recategorize-btn"
                onClick={handleRecategorizeAll}
                disabled={isRecategorizing || transactions.length === 0}
              >
                {isRecategorizing ? "Re-categorizing..." : "Smart Re-categorize All"}
              </button>
            </div>
            <TransactionTable
              transactions={transactionsForTable}
              initialCategory={drilldownCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        )}

        {view === "import" && (
          <div className="import-view">
            <div className="import-header">
              <h1>Import Statements</h1>
              <p>
                Upload your ICICI Bank statement to analyze your spending
              </p>
            </div>

            <FileDropZone
              onStatementParsed={handleStatementParsed}
              historicalTransactions={transactions}
              isLoading={isLoading}
            />

            <StatementList
              statements={transformedStatements}
              onDelete={handleDeleteStatement}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
