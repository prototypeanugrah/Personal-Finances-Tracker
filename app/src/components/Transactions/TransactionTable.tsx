import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCategoryById } from "../../lib/categorizer/defaultRules";
import "./TransactionTable.css";

interface Transaction {
  _id: string;
  serialNo: number;
  valueDate: number;
  transactionDate: number;
  remarks: string;
  withdrawalAmount: number;
  depositAmount: number;
  balance: number;
  categoryId: string;
  merchantName?: string;
  paymentMethod: string;
  statementType?: "debit" | "credit";
  rewardPoints?: number;
  userCategoryOverride?: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  initialCategory?: string | null;
  onCategoryChange?: (id: string, categoryId: string) => void;
}

type SortField = "date" | "amount" | "category";
type SortOrder = "asc" | "desc";

export function TransactionTable({
  transactions,
  initialCategory = null,
  onCategoryChange: _onCategoryChange,
}: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterCategory, setFilterCategory] = useState<string | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setFilterCategory(initialCategory);
  }, [initialCategory]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const sortedAndFilteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter by category
    if (filterCategory) {
      result = result.filter((tx) => {
        const effectiveCategory = tx.userCategoryOverride || tx.categoryId;
        return effectiveCategory === filterCategory;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.remarks.toLowerCase().includes(query) ||
          tx.merchantName?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = a.transactionDate - b.transactionDate;
          break;
        case "amount":
          const amountA = a.withdrawalAmount || a.depositAmount;
          const amountB = b.withdrawalAmount || b.depositAmount;
          comparison = amountA - amountB;
          break;
        case "category":
          const catA = a.userCategoryOverride || a.categoryId;
          const catB = b.userCategoryOverride || b.categoryId;
          comparison = catA.localeCompare(catB);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [transactions, sortField, sortOrder, filterCategory, searchQuery]);

  const getDescriptionLabel = (tx: Transaction) => {
    return tx.statementType === "credit" ? "Credit" : "UPI";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach((tx) => {
      cats.add(tx.userCategoryOverride || tx.categoryId);
    });
    return Array.from(cats).map((id) => getCategoryById(id));
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <h3>No Transactions</h3>
        <p>Import a bank statement to see your transactions here</p>
      </div>
    );
  }

  return (
    <div className="transaction-table-container">
      <div className="table-controls">
        <div className="search-box">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-filters">
          <button
            className={`filter-chip ${!filterCategory ? "active" : ""}`}
            onClick={() => setFilterCategory(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`filter-chip ${filterCategory === cat.id ? "active" : ""}`}
              style={
                filterCategory === cat.id
                  ? { backgroundColor: cat.color + "33", borderColor: cat.color }
                  : {}
              }
              onClick={() =>
                setFilterCategory(filterCategory === cat.id ? null : cat.id)
              }
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table className="transaction-table">
          <thead>
            <tr>
              <th
                className={`sortable ${sortField === "date" ? "sorted" : ""}`}
                onClick={() => handleSort("date")}
              >
                Date
                <SortIcon active={sortField === "date"} order={sortOrder} />
              </th>
              <th>Description</th>
              <th>Category</th>
              <th
                className={`sortable text-right ${sortField === "amount" ? "sorted" : ""}`}
                onClick={() => handleSort("amount")}
              >
                Amount
                <SortIcon active={sortField === "amount"} order={sortOrder} />
              </th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sortedAndFilteredTransactions.map((tx, index) => {
                const category = getCategoryById(
                  tx.userCategoryOverride || tx.categoryId
                );
                const isExpense = tx.withdrawalAmount > 0;
                const amount = isExpense ? tx.withdrawalAmount : tx.depositAmount;
                const transactionDetails = tx.remarks?.trim() || tx.merchantName || "Unknown";

                return (
                  <motion.tr
                    key={tx._id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <td className="date-cell">
                      <span className="date-value">{formatDate(tx.transactionDate)}</span>
                    </td>
                    <td className="description-cell">
                      <div className="description-content">
                        <span className="merchant-name" title={transactionDetails}>
                          {transactionDetails}
                        </span>
                        <span className="payment-method badge">
                          {getDescriptionLabel(tx)}
                        </span>
                      </div>
                    </td>
                    <td className="category-cell">
                      <span
                        className="category-pill"
                        style={{
                          backgroundColor: category.color + "22",
                          color: category.color,
                        }}
                      >
                        {category.icon} {category.name}
                      </span>
                    </td>
                    <td className="amount-cell text-right">
                      <span
                        className={`amount ${isExpense ? "amount-expense" : "amount-income"}`}
                      >
                        {isExpense ? "-" : "+"} {formatAmount(amount)}
                      </span>
                    </td>
                    <td className="balance-cell text-right">
                      <span className="balance">{formatAmount(tx.balance)}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span className="transaction-count">
          Showing {sortedAndFilteredTransactions.length} of {transactions.length}{" "}
          transactions
        </span>
      </div>
    </div>
  );
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  return (
    <svg
      className={`sort-icon ${active ? "active" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {order === "asc" || !active ? (
        <polyline points="18 15 12 9 6 15" />
      ) : (
        <polyline points="6 9 12 15 18 9" />
      )}
    </svg>
  );
}
