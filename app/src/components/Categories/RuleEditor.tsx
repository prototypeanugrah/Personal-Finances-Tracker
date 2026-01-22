import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { defaultRules, defaultCategories } from "../../lib/categorizer/defaultRules";
import type { CategorizationRule } from "../../lib/categorizer/categoryEngine";
import "./RuleEditor.css";

interface RuleEditorProps {
  onRulesChange?: (rules: CategorizationRule[]) => void;
}

export function RuleEditor({ onRulesChange }: RuleEditorProps) {
  const [rules, setRules] = useState<CategorizationRule[]>(defaultRules);
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const getCategoryName = (categoryId: string) => {
    const cat = defaultCategories.find((c) => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.name}` : categoryId;
  };

  const handleSaveRule = (rule: CategorizationRule) => {
    const newRules = editingRule
      ? rules.map((r) =>
          r.priority === editingRule.priority && r.pattern === editingRule.pattern
            ? rule
            : r
        )
      : [...rules, rule];

    setRules(newRules);
    onRulesChange?.(newRules);
    setEditingRule(null);
    setIsAddingNew(false);
  };

  const handleDeleteRule = (rule: CategorizationRule) => {
    const newRules = rules.filter(
      (r) => !(r.priority === rule.priority && r.pattern === rule.pattern)
    );
    setRules(newRules);
    onRulesChange?.(newRules);
  };

  return (
    <div className="rule-editor">
      <div className="rule-editor-header">
        <h3>Categorization Rules</h3>
        <button
          className="btn-primary"
          onClick={() => {
            setIsAddingNew(true);
            setEditingRule({
              priority: Math.max(...rules.map((r) => r.priority)) + 1,
              categoryId: "uncategorized",
              type: "keyword",
              pattern: "",
              field: "remarks",
            });
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Rule
        </button>
      </div>

      <div className="rules-list">
        {rules
          .sort((a, b) => a.priority - b.priority)
          .map((rule, index) => (
            <motion.div
              key={`${rule.priority}-${rule.pattern}`}
              className="rule-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <div className="rule-priority">{rule.priority}</div>
              <div className="rule-content">
                <div className="rule-header">
                  <span className="rule-category">
                    {getCategoryName(rule.categoryId)}
                  </span>
                  <span className="rule-type badge">{rule.type}</span>
                </div>
                <div className="rule-pattern">
                  <code>{rule.pattern}</code>
                </div>
                <div className="rule-meta">
                  <span>Field: {rule.field}</span>
                  {rule.minAmount && <span>Min: ₹{rule.minAmount}</span>}
                  {rule.maxAmount && <span>Max: ₹{rule.maxAmount}</span>}
                </div>
              </div>
              <div className="rule-actions">
                <button
                  className="rule-action-btn"
                  onClick={() => setEditingRule(rule)}
                  title="Edit rule"
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
                <button
                  className="rule-action-btn danger"
                  onClick={() => handleDeleteRule(rule)}
                  title="Delete rule"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
      </div>

      {/* Edit/Add Modal */}
      <AnimatePresence>
        {editingRule && (
          <RuleModal
            rule={editingRule}
            isNew={isAddingNew}
            onSave={handleSaveRule}
            onCancel={() => {
              setEditingRule(null);
              setIsAddingNew(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface RuleModalProps {
  rule: CategorizationRule;
  isNew: boolean;
  onSave: (rule: CategorizationRule) => void;
  onCancel: () => void;
}

function RuleModal({ rule, isNew, onSave, onCancel }: RuleModalProps) {
  const [formData, setFormData] = useState(rule);

  return (
    <motion.div
      className="rule-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="rule-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{isNew ? "Add New Rule" : "Edit Rule"}</h3>

        <div className="modal-field">
          <label>Priority</label>
          <input
            type="number"
            value={formData.priority}
            onChange={(e) =>
              setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
            }
          />
        </div>

        <div className="modal-field">
          <label>Category</label>
          <select
            value={formData.categoryId}
            onChange={(e) =>
              setFormData({ ...formData, categoryId: e.target.value })
            }
          >
            {defaultCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>Rule Type</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as CategorizationRule["type"],
              })
            }
          >
            <option value="keyword">Keyword</option>
            <option value="regex">Regex</option>
            <option value="merchant">Merchant</option>
            <option value="deposit">Deposit</option>
            <option value="amount">Amount</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Pattern (use | for OR)</label>
          <input
            type="text"
            value={formData.pattern}
            onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
            placeholder="KEYWORD1|KEYWORD2|KEYWORD3"
          />
        </div>

        <div className="modal-field">
          <label>Match Field</label>
          <select
            value={formData.field}
            onChange={(e) =>
              setFormData({
                ...formData,
                field: e.target.value as "remarks" | "merchant",
              })
            }
          >
            <option value="remarks">Remarks</option>
            <option value="merchant">Merchant</option>
          </select>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Min Amount (optional)</label>
            <input
              type="number"
              value={formData.minAmount || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  minAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="modal-field">
            <label>Max Amount (optional)</label>
            <input
              type="number"
              value={formData.maxAmount || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onSave(formData)}>
            {isNew ? "Add Rule" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
