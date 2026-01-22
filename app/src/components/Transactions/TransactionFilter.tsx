import { useState } from "react";
import "./TransactionFilter.css";

interface FilterOptions {
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  categories: string[];
  paymentMethods: string[];
  transactionType: "all" | "expense" | "income";
}

interface TransactionFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  availableCategories: Array<{ id: string; name: string; icon: string; color: string }>;
}

export function TransactionFilter({
  onFilterChange,
  availableCategories,
}: TransactionFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    paymentMethods: [],
    transactionType: "all",
  });

  const updateFilters = (updates: Partial<FilterOptions>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const resetFilters: FilterOptions = {
      categories: [],
      paymentMethods: [],
      transactionType: "all",
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.paymentMethods.length > 0 ||
    filters.transactionType !== "all" ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.minAmount ||
    filters.maxAmount;

  const paymentMethods = ["UPI", "NEFT", "IMPS", "CARD", "ATM", "OTHER"];

  return (
    <div className="transaction-filter">
      <div className="filter-header">
        <button
          className="filter-toggle btn-secondary"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {hasActiveFilters && <span className="filter-badge" />}
        </button>

        {hasActiveFilters && (
          <button className="clear-filters btn-ghost" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-panel card">
          <div className="filter-section">
            <label className="filter-label">Transaction Type</label>
            <div className="filter-options">
              {(["all", "expense", "income"] as const).map((type) => (
                <button
                  key={type}
                  className={`filter-option ${filters.transactionType === type ? "active" : ""}`}
                  onClick={() => updateFilters({ transactionType: type })}
                >
                  {type === "all" ? "All" : type === "expense" ? "Expenses" : "Income"}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Payment Method</label>
            <div className="filter-options">
              {paymentMethods.map((method) => (
                <button
                  key={method}
                  className={`filter-option ${filters.paymentMethods.includes(method) ? "active" : ""}`}
                  onClick={() => {
                    const newMethods = filters.paymentMethods.includes(method)
                      ? filters.paymentMethods.filter((m) => m !== method)
                      : [...filters.paymentMethods, method];
                    updateFilters({ paymentMethods: newMethods });
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Categories</label>
            <div className="filter-options category-options">
              {availableCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={`filter-option category-option ${filters.categories.includes(cat.id) ? "active" : ""}`}
                  style={
                    filters.categories.includes(cat.id)
                      ? { backgroundColor: cat.color + "33", borderColor: cat.color }
                      : {}
                  }
                  onClick={() => {
                    const newCategories = filters.categories.includes(cat.id)
                      ? filters.categories.filter((c) => c !== cat.id)
                      : [...filters.categories, cat.id];
                    updateFilters({ categories: newCategories });
                  }}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section filter-row">
            <div className="filter-field">
              <label className="filter-label">Min Amount</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minAmount || ""}
                onChange={(e) =>
                  updateFilters({
                    minAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="filter-field">
              <label className="filter-label">Max Amount</label>
              <input
                type="number"
                placeholder="No limit"
                value={filters.maxAmount || ""}
                onChange={(e) =>
                  updateFilters({
                    maxAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
