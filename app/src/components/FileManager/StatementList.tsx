import { motion } from "framer-motion";
import "./StatementList.css";

interface Statement {
  _id: string;
  filename: string;
  statementType?: "debit" | "credit";
  importedAt: number;
  accountNumber: string;
  accountHolder: string;
  dateFrom: number;
  dateTo: number;
  transactionCount: number;
  cashbackTransferred?: number;
}

interface StatementListProps {
  statements: Statement[];
  onDelete?: (id: string) => void;
}

export function StatementList({ statements, onDelete }: StatementListProps) {
  if (statements.length === 0) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="statement-list">
      <h3 className="statement-list-title">Imported Statements</h3>
      <div className="statement-items stagger">
        {statements.map((statement, index) => (
          <motion.div
            key={statement._id}
            className="statement-item card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="statement-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>

            <div className="statement-info">
              <div className="statement-filename">{statement.filename}</div>
              <div className="statement-meta">
                <span className="statement-period">
                  {formatDate(statement.dateFrom)} - {formatDate(statement.dateTo)}
                </span>
                <span className="statement-divider">•</span>
                <span className="statement-count">
                  {statement.transactionCount} transactions
                </span>
                <span className="statement-divider">•</span>
                <span className="statement-count">
                  {statement.statementType === "credit" ? "Credit" : "Debit"}
                </span>
                {statement.statementType === "credit" &&
                  (statement.cashbackTransferred || 0) > 0 && (
                    <>
                      <span className="statement-divider">•</span>
                      <span className="statement-count">
                        Cashback: {statement.cashbackTransferred}
                      </span>
                    </>
                  )}
              </div>
            </div>

            <div className="statement-actions">
              <span className="statement-badge">
                {statement.accountNumber.slice(-4)}
              </span>
              {onDelete && (
                <button
                  className="statement-delete btn-ghost"
                  onClick={() => onDelete(statement._id)}
                  title="Delete statement"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
