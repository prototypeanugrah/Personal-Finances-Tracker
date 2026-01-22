import { useMemo } from "react";
import "./MonthSelector.css";

interface MonthOption {
  value: string; // "2026-01" format
  label: string; // "January 2026" format
  transactionCount: number;
}

interface MonthSelectorProps {
  availableMonths: MonthOption[];
  selectedMonth: string | null; // null means "All Time"
  onMonthChange: (month: string | null) => void;
}

export function MonthSelector({
  availableMonths,
  selectedMonth,
  onMonthChange,
}: MonthSelectorProps) {
  const sortedMonths = useMemo(() => {
    return [...availableMonths].sort((a, b) => b.value.localeCompare(a.value));
  }, [availableMonths]);

  const selectedLabel = useMemo(() => {
    if (!selectedMonth) return "All Time";
    const month = availableMonths.find((m) => m.value === selectedMonth);
    return month?.label || selectedMonth;
  }, [selectedMonth, availableMonths]);

  return (
    <div className="month-selector">
      <div className="month-selector-label">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>Period</span>
      </div>

      <div className="month-dropdown-wrapper">
        <select
          className="month-dropdown"
          value={selectedMonth || "all"}
          onChange={(e) =>
            onMonthChange(e.target.value === "all" ? null : e.target.value)
          }
        >
          <option value="all">All Time</option>
          {sortedMonths.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label} ({month.transactionCount})
            </option>
          ))}
        </select>
        <div className="dropdown-arrow">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {selectedMonth && (
        <div className="selected-month-display">
          <span className="month-name">{selectedLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Get month string from timestamp
 */
export function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Format month key to display label
 */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
