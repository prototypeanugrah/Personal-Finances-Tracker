import { useState, useCallback, useEffect } from "react";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { FileDropZone } from "./components/FileManager/FileDropZone";
import { StatementList } from "./components/FileManager/StatementList";
import { TransactionTable } from "./components/Transactions/TransactionTable";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { ParsedStatement } from "./lib/parser/xlsParser";
import type { CategorizedTransaction } from "./lib/categorizer/categoryEngine";
import "./styles/globals.css";
import "./App.css";

type View = "dashboard" | "transactions" | "import";

interface StoredStatement {
  _id: string;
  filename: string;
  importedAt: number;
  accountNumber: string;
  accountHolder: string;
  dateFrom: number;
  dateTo: number;
  transactionCount: number;
  fileHash: string;
}

interface StoredTransaction extends CategorizedTransaction {
  _id: string;
  statementId: string;
}

function App() {
  const [view, setView] = useState<View>("import");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use localStorage for persistent storage
  const [statements, setStatements] = useLocalStorage<StoredStatement[]>(
    "expense-tracker-statements",
    []
  );
  const [transactions, setTransactions] = useLocalStorage<StoredTransaction[]>(
    "expense-tracker-transactions",
    []
  );

  // Auto-navigate to dashboard if we have data
  useEffect(() => {
    if (transactions.length > 0 && view === "import") {
      setView("dashboard");
    }
  }, []);

  const handleStatementParsed = useCallback(
    (statement: ParsedStatement, categorizedTransactions: CategorizedTransaction[]) => {
      // Generate IDs for storage
      const statementId = `stmt_${Date.now()}`;

      // Create filename from date range
      const dateFrom = statement.dateFrom;
      const monthName = dateFrom.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const newStatement: StoredStatement = {
        _id: statementId,
        filename: `${monthName} Statement`,
        importedAt: Date.now(),
        accountNumber: statement.accountNumber,
        accountHolder: statement.accountHolder,
        dateFrom: statement.dateFrom.getTime(),
        dateTo: statement.dateTo.getTime(),
        transactionCount: categorizedTransactions.length,
        fileHash: statement.fileHash,
      };

      // Check for duplicates
      const isDuplicate = statements.some(
        (s) => s.fileHash === statement.fileHash
      );

      if (isDuplicate) {
        alert("This statement has already been imported.");
        return;
      }

      const newTransactions: StoredTransaction[] = categorizedTransactions.map(
        (tx, index) => ({
          ...tx,
          _id: `tx_${Date.now()}_${index}`,
          statementId,
        })
      );

      setStatements((prev) => [newStatement, ...prev]);
      setTransactions((prev) => [...prev, ...newTransactions]);

      // Set selected month to the newly imported month
      const year = dateFrom.getFullYear();
      const month = String(dateFrom.getMonth() + 1).padStart(2, "0");
      setSelectedMonth(`${year}-${month}`);

      setView("dashboard");
    },
    [statements, setStatements, setTransactions]
  );

  const handleDeleteStatement = useCallback((id: string) => {
    setStatements((prev) => prev.filter((s) => s._id !== id));
    setTransactions((prev) => prev.filter((tx) => tx.statementId !== id));
  }, [setStatements, setTransactions]);

  const handleCategoryChange = useCallback((id: string, categoryId: string) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx._id === id ? { ...tx, userCategoryOverride: categoryId } : tx
      )
    );
  }, [setTransactions]);

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
            transactions={transactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            onCategoryClick={(categoryId) => {
              setView("transactions");
            }}
          />
        )}

        {view === "transactions" && (
          <div className="transactions-view">
            <h1>Transactions</h1>
            <TransactionTable
              transactions={transactions}
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
              statements={statements}
              onDelete={handleDeleteStatement}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
