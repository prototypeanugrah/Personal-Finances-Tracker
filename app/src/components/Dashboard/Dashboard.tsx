import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SpendingWheel } from "./SpendingWheel";
import { TransactionStream } from "./TransactionStream";
import { CategorySummary } from "./CategorySummary";
import { MonthSelector, getMonthKey, formatMonthLabel } from "./MonthSelector";
import "./Dashboard.css";

interface Transaction {
  _id: string;
  transactionDate: number;
  withdrawalAmount: number;
  depositAmount: number;
  categoryId: string;
  statementType?: "debit" | "credit";
  rewardPoints?: number;
  userCategoryOverride?: string;
}

interface DashboardProps {
  transactions: Transaction[];
  onCategoryClick?: (categoryId: string) => void;
  selectedMonth?: string | null;
  onMonthChange?: (month: string | null) => void;
}

export function Dashboard({
  transactions,
  onCategoryClick,
  selectedMonth: externalSelectedMonth,
  onMonthChange: externalOnMonthChange,
}: DashboardProps) {
  const [internalSelectedMonth, setInternalSelectedMonth] = useState<string | null>(null);

  const selectedMonth = externalSelectedMonth !== undefined ? externalSelectedMonth : internalSelectedMonth;
  const onMonthChange = externalOnMonthChange || setInternalSelectedMonth;

  // Derive available months from live transactions
  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, number>();
    transactions.forEach((tx) => {
      const monthKey = getMonthKey(tx.transactionDate);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
    });

    return Array.from(monthMap.entries()).map(([value, count]) => ({
      value,
      label: formatMonthLabel(value),
      transactionCount: count,
    }));
  }, [transactions]);

  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      const sortedMonths = [...availableMonths].sort((a, b) =>
        b.value.localeCompare(a.value)
      );
      onMonthChange(sortedMonths[0].value);
    }
  }, [availableMonths, selectedMonth, onMonthChange]);

  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;
    return transactions.filter((tx) => getMonthKey(tx.transactionDate) === selectedMonth);
  }, [transactions, selectedMonth]);

  const stats = useMemo(() => {
    const totalExpenses = filteredTransactions.reduce(
      (sum, tx) => sum + tx.withdrawalAmount,
      0
    );
    const totalIncome = filteredTransactions.reduce(
      (sum, tx) => sum + tx.depositAmount,
      0
    );
    const netFlow = totalIncome - totalExpenses;

    const categoryMap = new Map<string, { amount: number; count: number }>();

    filteredTransactions.forEach((tx) => {
      if (tx.withdrawalAmount > 0) {
        const cat = tx.userCategoryOverride || tx.categoryId;
        const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
        categoryMap.set(cat, {
          amount: existing.amount + tx.withdrawalAmount,
          count: existing.count + 1,
        });
      }
    });

    const categories = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        amount: data.amount,
        count: data.count,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      }))
      .filter((c) => c.amount > 0);

    const ccCashbackTotal = filteredTransactions
      .filter((tx) => tx.statementType === "credit")
      .reduce((sum, tx) => sum + (tx.rewardPoints || 0), 0);

    return { totalExpenses, totalIncome, netFlow, categories, ccCashbackTotal };
  }, [filteredTransactions]);

  // Calculate daily data for stream chart (using filtered transactions)
  const dailyData = useMemo(() => {
    const dailyMap = new Map<
      string,
      { date: Date; expenses: number; income: number }
    >();

    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.transactionDate);
      const key = date.toISOString().split("T")[0];

      const existing = dailyMap.get(key) || {
        date: new Date(key),
        expenses: 0,
        income: 0,
      };

      dailyMap.set(key, {
        date: new Date(key),
        expenses: existing.expenses + tx.withdrawalAmount,
        income: existing.income + tx.depositAmount,
      });
    });

    return Array.from(dailyMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [filteredTransactions]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (transactions.length === 0) {
    return (
      <div className="dashboard empty-state">
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <h2>No Transaction Data</h2>
        <p>Import a bank statement to see your spending insights</p>
      </div>
    );
  }

  return (
    <div className="dashboard gradient-mesh">
      <div className="dashboard-header">
        <h1>Financial Overview</h1>
        <p className="dashboard-period">
          {filteredTransactions.length} transactions
          {selectedMonth && ` in ${formatMonthLabel(selectedMonth)}`}
        </p>
      </div>

      {/* Month Selector */}
      {availableMonths.length > 0 && (
        <MonthSelector
          availableMonths={availableMonths}
          selectedMonth={selectedMonth}
          onMonthChange={onMonthChange}
        />
      )}

      {/* Summary Cards */}
      <div className="summary-cards stagger">
        <motion.div
          className="summary-card income"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="card-content">
            <span className="card-label">Income</span>
            <span className="card-amount">{formatAmount(stats.totalIncome)}</span>
          </div>
        </motion.div>

        <motion.div
          className="summary-card expense"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div className="card-content">
            <span className="card-label">Expenses</span>
            <span className="card-amount">{formatAmount(stats.totalExpenses)}</span>
          </div>
        </motion.div>

        <motion.div
          className={`summary-card ${stats.netFlow >= 0 ? "positive" : "negative"}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="card-content">
            <span className="card-label">Net Flow</span>
            <span className="card-amount">
              {stats.netFlow >= 0 ? "+" : ""}
              {formatAmount(stats.netFlow)}
            </span>
          </div>
        </motion.div>

        <motion.div
          className="summary-card cashback"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v20" />
              <path d="M17 6H9a3 3 0 0 0 0 6h4a3 3 0 1 1 0 6H7" />
            </svg>
          </div>
          <div className="card-content">
            <span className="card-label">Cashback from CC</span>
            <span className="card-amount">{formatAmount(stats.ccCashbackTotal)}</span>
          </div>
        </motion.div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Spending Wheel */}
        <motion.div
          className="dashboard-card wheel-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <SpendingWheel
            data={stats.categories}
            totalExpenses={stats.totalExpenses}
            size={280}
          />
        </motion.div>

        {/* Category Summary */}
        <motion.div
          className="dashboard-card categories-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <CategorySummary
            categories={stats.categories}
            totalExpenses={stats.totalExpenses}
            onCategoryClick={onCategoryClick}
          />
        </motion.div>
      </div>

      {/* Transaction Stream */}
      <motion.div
        className="stream-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <TransactionStream data={dailyData} height={220} />
      </motion.div>
    </div>
  );
}
