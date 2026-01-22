import { motion } from "framer-motion";
import { getCategoryById } from "../../lib/categorizer/defaultRules";
import "./CategorySummary.css";

interface CategoryData {
  categoryId: string;
  amount: number;
  count: number;
  percentage: number;
}

interface CategorySummaryProps {
  categories: CategoryData[];
  totalExpenses: number;
  onCategoryClick?: (categoryId: string) => void;
}

export function CategorySummary({
  categories,
  totalExpenses,
  onCategoryClick,
}: CategorySummaryProps) {
  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  // Sort by amount descending
  const sortedCategories = [...categories].sort((a, b) => b.amount - a.amount);

  return (
    <div className="category-summary">
      <div className="summary-header">
        <h3>Spending by Category</h3>
        <span className="total-amount">
          Total: <strong>{formatAmount(totalExpenses)}</strong>
        </span>
      </div>

      <div className="category-cards stagger">
        {sortedCategories.map((cat, index) => {
          const categoryInfo = getCategoryById(cat.categoryId);

          return (
            <motion.div
              key={cat.categoryId}
              className="category-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onCategoryClick?.(cat.categoryId)}
              whileHover={{ scale: 1.02, y: -2 }}
              style={{
                "--category-color": categoryInfo.color,
              } as React.CSSProperties}
            >
              <div className="category-card-header">
                <span className="category-icon">{categoryInfo.icon}</span>
                <div className="category-info">
                  <span className="category-name">{categoryInfo.name}</span>
                  <span className="category-count">{cat.count} transactions</span>
                </div>
                <span className="category-percentage">
                  {cat.percentage.toFixed(0)}%
                </span>
              </div>

              <div className="category-card-footer">
                <span className="category-amount">
                  {formatAmount(cat.amount)}
                </span>
                <div className="category-bar">
                  <motion.div
                    className="category-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.percentage}%` }}
                    transition={{ duration: 0.6, delay: index * 0.05 + 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
