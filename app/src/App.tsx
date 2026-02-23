import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { FileDropZone } from "./components/FileManager/FileDropZone";
import { StatementList } from "./components/FileManager/StatementList";
import { TransactionTable } from "./components/Transactions/TransactionTable";
import type { ParsedStatement } from "./lib/parser/xlsParser";
import type { CategorizedTransaction } from "./lib/categorizer/categoryEngine";
import "./styles/globals.css";
import "./App.css";

type View = "dashboard" | "transactions" | "import";

function App() {
  const [view, setView] = useState<View>("import");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Convex queries
  const statements = useQuery(api.statements.list) ?? [];
  const transactions = useQuery(api.transactions.list, {}) ?? [];
  const monthlySummaries = useQuery(api.monthlySummary.listMonths) ?? [];

  // Convex mutations
  const importStatement = useMutation(api.statements.importStatement);
  const removeStatement = useMutation(api.statements.remove);
  const updateCategory = useMutation(api.transactions.updateCategory);

  // Auto-navigate to dashboard if we have data
  useEffect(() => {
    if (transactions.length > 0 && view === "import") {
      setView("dashboard");
    }
  }, [transactions.length]);

  // Auto-select the most recent month when summaries load
  useEffect(() => {
    if (monthlySummaries.length > 0 && !selectedMonth) {
      setSelectedMonth(monthlySummaries[0].monthKey);
    }
  }, [monthlySummaries, selectedMonth]);

  const handleStatementParsed = useCallback(
    async (statement: ParsedStatement, categorizedTransactions: CategorizedTransaction[]) => {
      setIsLoading(true);

      try {
        // Create filename from date range
        const dateFrom = statement.dateFrom;
        const monthName = dateFrom.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        // Prepare statement data
        const statementData = {
          filename: `${monthName} Statement`,
          accountNumber: statement.accountNumber,
          accountHolder: statement.accountHolder,
          dateFrom: statement.dateFrom.getTime(),
          dateTo: statement.dateTo.getTime(),
          transactionCount: categorizedTransactions.length,
          fileHash: statement.fileHash,
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
        }));

        // Import using the combined mutation
        const result = await importStatement({
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
        alert("Failed to import statement. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [importStatement]
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

  // Transform transactions to include _id as string for components
  const transformedTransactions = transactions.map((tx) => ({
    ...tx,
    _id: tx._id.toString(),
    statementId: tx.statementId.toString(),
  }));

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
            onClick={() => setView("transactions")}
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
            onCategoryClick={() => {
              setView("transactions");
            }}
          />
        )}

        {view === "transactions" && (
          <div className="transactions-view">
            <h1>Transactions</h1>
            <TransactionTable
              transactions={transformedTransactions}
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
