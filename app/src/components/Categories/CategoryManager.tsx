import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { defaultCategories } from "../../lib/categorizer/defaultRules";
import "./CategoryManager.css";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CategoryManagerProps {
  onCategorySelect?: (categoryId: string) => void;
  selectedCategory?: string;
}

export function CategoryManager({
  onCategorySelect,
  selectedCategory,
}: CategoryManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleCategoryClick = (categoryId: string) => {
    onCategorySelect?.(categoryId);
  };

  return (
    <div className="category-manager">
      <div className="category-manager-header">
        <h3>Categories</h3>
        <button
          className="btn-secondary"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="category-list">
        <AnimatePresence>
          {defaultCategories.map((category, index) => (
            <motion.button
              key={category.id}
              className={`category-item ${
                selectedCategory === category.id ? "selected" : ""
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleCategoryClick(category.id)}
              style={
                {
                  "--category-color": category.color,
                } as React.CSSProperties
              }
            >
              <span className="category-item-icon">{category.icon}</span>
              <span className="category-item-name">{category.name}</span>
              <span
                className="category-item-color"
                style={{ backgroundColor: category.color }}
              />
              {isEditing && (
                <button
                  className="category-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCategory(category);
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingCategory && (
          <motion.div
            className="category-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingCategory(null)}
          >
            <motion.div
              className="category-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Edit Category</h3>
              <div className="modal-field">
                <label>Name</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="modal-field">
                <label>Icon</label>
                <input
                  type="text"
                  value={editingCategory.icon}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      icon: e.target.value,
                    })
                  }
                />
              </div>
              <div className="modal-field">
                <label>Color</label>
                <input
                  type="color"
                  value={editingCategory.color}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      color: e.target.value,
                    })
                  }
                />
              </div>
              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setEditingCategory(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    // Save logic would go here
                    setEditingCategory(null);
                  }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
