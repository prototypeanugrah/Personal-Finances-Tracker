import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseICICIStatement } from "../../lib/parser/iciciParser";
import { processTransactions } from "../../lib/categorizer/categoryEngine";
import { defaultRules } from "../../lib/categorizer/defaultRules";
import type { ParsedStatement } from "../../lib/parser/xlsParser";
import type { CategorizedTransaction } from "../../lib/categorizer/categoryEngine";
import "./FileDropZone.css";

interface FileDropZoneProps {
  onStatementParsed: (
    statement: ParsedStatement,
    transactions: CategorizedTransaction[]
  ) => void;
  historicalTransactions?: {
    remarks: string;
    merchantName?: string;
    categoryId: string;
    userCategoryOverride?: string;
    withdrawalAmount: number;
    depositAmount: number;
  }[];
  isLoading?: boolean;
}

export function FileDropZone({
  onStatementParsed,
  historicalTransactions = [],
  isLoading,
}: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statementType, setStatementType] = useState<"debit" | "credit">("debit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      if (statementType === "credit" && !isPdf) {
        setError(
          "Credit mode currently supports PDF statements only. Switch to Debit for XLS/XLSX/CSV."
        );
        return;
      }

      setProcessing(true);

      try {
        // Parse the statement
        const statement = await parseICICIStatement(file, statementType);

        // Process and categorize transactions
        const categorizedTransactions = processTransactions(
          statement.transactions,
          defaultRules,
          statement.statementType,
          { historicalTransactions }
        );

        onStatementParsed(statement, categorizedTransactions);
      } catch (err) {
        console.error("Error parsing file:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to parse the bank statement"
        );
      } finally {
        setProcessing(false);
      }
    },
    [historicalTransactions, onStatementParsed, statementType]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Allow selecting the same file again after an error.
      e.target.value = "";
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const isDisabled = processing || isLoading;

  return (
    <div className="file-drop-container">
      <div className="statement-type-actions" aria-label="Statement Type Actions">
        <button
          type="button"
          className={`statement-action-btn ${statementType === "debit" ? "active" : ""}`}
          onClick={() => setStatementType("debit")}
          disabled={isDisabled}
        >
          Debit Statement
        </button>
        <button
          type="button"
          className={`statement-action-btn ${statementType === "credit" ? "active" : ""}`}
          onClick={() => setStatementType("credit")}
          disabled={isDisabled}
        >
          Credit Statement
        </button>
      </div>

      <motion.div
        className={`drop-zone ${isDragActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        whileHover={{ scale: isDisabled ? 1 : 1.01 }}
        whileTap={{ scale: isDisabled ? 1 : 0.99 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={statementType === "credit" ? ".pdf" : ".pdf,.xls,.xlsx,.csv"}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          disabled={isDisabled}
        />

        <AnimatePresence mode="wait">
          {processing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="drop-zone-content"
            >
              <div className="spinner" />
              <h3>Processing Statement...</h3>
              <p>Parsing transactions and categorizing</p>
            </motion.div>
          ) : isDragActive ? (
            <motion.div
              key="drag-active"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="drop-zone-content"
            >
              <div className="drop-icon active">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3>Drop to Import</h3>
              <p>Release to process the statement</p>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="drop-zone-content"
            >
              <div className="drop-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3>
                Import {statementType === "credit" ? "Credit Card" : "Debit Card"} Statement
              </h3>
              <p>
                Drag & drop your{" "}
                {statementType === "credit" ? "PDF" : "PDF/XLS/XLSX/CSV"} file here, or click
                to browse
              </p>
              <span className="file-types">
                {statementType === "credit"
                  ? "Supports ICICI credit statements (.pdf)"
                  : "Supports ICICI debit statements (.pdf, .xls, .xlsx, .csv)"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
