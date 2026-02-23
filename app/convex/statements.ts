import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to format month key
function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Helper to parse month key
function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

export const create = mutation({
  args: {
    filename: v.string(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    dateFrom: v.number(),
    dateTo: v.number(),
    transactionCount: v.number(),
    fileHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if statement already exists by hash
    const existing = await ctx.db
      .query("statements")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.fileHash))
      .first();

    if (existing) {
      return { id: existing._id, alreadyExists: true };
    }

    const id = await ctx.db.insert("statements", {
      ...args,
      importedAt: Date.now(),
    });

    return { id, alreadyExists: false };
  },
});

// Combined import mutation - creates statement, transactions, and updates monthly summary
export const importStatement = mutation({
  args: {
    statement: v.object({
      filename: v.string(),
      accountNumber: v.string(),
      accountHolder: v.string(),
      dateFrom: v.number(),
      dateTo: v.number(),
      transactionCount: v.number(),
      fileHash: v.string(),
    }),
    transactions: v.array(
      v.object({
        serialNo: v.number(),
        valueDate: v.number(),
        transactionDate: v.number(),
        chequeNumber: v.optional(v.string()),
        remarks: v.string(),
        withdrawalAmount: v.number(),
        depositAmount: v.number(),
        balance: v.number(),
        categoryId: v.string(),
        merchantName: v.optional(v.string()),
        paymentMethod: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if statement already exists by hash
    const existing = await ctx.db
      .query("statements")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.statement.fileHash))
      .first();

    if (existing) {
      return { statementId: existing._id, alreadyExists: true, transactionIds: [] };
    }

    // Insert statement
    const statementId = await ctx.db.insert("statements", {
      ...args.statement,
      importedAt: Date.now(),
    });

    // Insert transactions
    const transactionIds = [];
    for (const tx of args.transactions) {
      const id = await ctx.db.insert("transactions", {
        ...tx,
        statementId,
      });
      transactionIds.push(id);
    }

    // Calculate affected months and update monthly summaries
    const affectedMonths = new Set<string>();
    for (const tx of args.transactions) {
      const date = new Date(tx.transactionDate);
      const monthKey = formatMonthKey(date.getFullYear(), date.getMonth() + 1);
      affectedMonths.add(monthKey);
    }

    // Update monthly summaries for each affected month
    for (const monthKey of affectedMonths) {
      await updateMonthlySummary(ctx, monthKey, statementId);
    }

    return { statementId, alreadyExists: false, transactionIds };
  },
});

// Internal helper to update monthly summary
async function updateMonthlySummary(
  ctx: any,
  monthKey: string,
  statementId: any
) {
  const { year, month } = parseMonthKey(monthKey);

  // Get all transactions for this month
  const allTransactions = await ctx.db
    .query("transactions")
    .withIndex("by_date")
    .collect();

  // Filter to this month's transactions
  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const monthTransactions = allTransactions.filter(
    (tx: any) => tx.transactionDate >= monthStart && tx.transactionDate <= monthEnd
  );

  if (monthTransactions.length === 0) {
    return null;
  }

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryBreakdown: Record<
    string,
    { amount: number; count: number; type: "expense" | "income" }
  > = {};

  // Sort by date to get opening/closing balance
  const sorted = [...monthTransactions].sort(
    (a: any, b: any) => a.transactionDate - b.transactionDate
  );

  const openingBalance = sorted[0].balance;
  const closingBalance = sorted[sorted.length - 1].balance;

  for (const tx of monthTransactions) {
    const category = tx.userCategoryOverride || tx.categoryId;

    if (tx.depositAmount > 0) {
      totalIncome += tx.depositAmount;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { amount: 0, count: 0, type: "income" };
      }
      categoryBreakdown[category].amount += tx.depositAmount;
      categoryBreakdown[category].count += 1;
      categoryBreakdown[category].type = "income";
    }

    if (tx.withdrawalAmount > 0) {
      totalExpenses += tx.withdrawalAmount;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { amount: 0, count: 0, type: "expense" };
      }
      categoryBreakdown[category].amount += tx.withdrawalAmount;
      categoryBreakdown[category].count += 1;
      categoryBreakdown[category].type = "expense";
    }
  }

  // Get existing statement IDs and add the new one
  const existingSummary = await ctx.db
    .query("monthlySummary")
    .withIndex("by_month", (q: any) => q.eq("monthKey", monthKey))
    .first();

  const statementIds = existingSummary
    ? [...new Set([...existingSummary.statementIds, statementId])]
    : [statementId];

  const summaryData = {
    monthKey,
    year,
    month,
    totalIncome,
    totalExpenses,
    netFlow: totalIncome - totalExpenses,
    transactionCount: monthTransactions.length,
    openingBalance,
    closingBalance,
    categoryBreakdown: JSON.stringify(categoryBreakdown),
    statementIds,
    lastUpdated: Date.now(),
  };

  if (existingSummary) {
    await ctx.db.patch(existingSummary._id, summaryData);
    return existingSummary._id;
  } else {
    return await ctx.db.insert("monthlySummary", summaryData);
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("statements").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("statements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("statements") },
  handler: async (ctx, args) => {
    // Get transactions to find affected months before deleting
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.id))
      .collect();

    // Track affected months
    const affectedMonths = new Set<string>();
    for (const tx of transactions) {
      const date = new Date(tx.transactionDate);
      const monthKey = formatMonthKey(date.getFullYear(), date.getMonth() + 1);
      affectedMonths.add(monthKey);
    }

    // Delete all transactions for this statement
    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    // Delete the statement
    await ctx.db.delete(args.id);

    // Update monthly summaries - remove this statement and recalculate
    for (const monthKey of affectedMonths) {
      await recalculateMonthlySummary(ctx, monthKey);
    }
  },
});

// Internal helper to recalculate monthly summary after deletion
async function recalculateMonthlySummary(ctx: any, monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);

  // Get all remaining transactions for this month
  const allTransactions = await ctx.db
    .query("transactions")
    .withIndex("by_date")
    .collect();

  // Filter to this month's transactions
  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const monthTransactions = allTransactions.filter(
    (tx: any) => tx.transactionDate >= monthStart && tx.transactionDate <= monthEnd
  );

  const existingSummary = await ctx.db
    .query("monthlySummary")
    .withIndex("by_month", (q: any) => q.eq("monthKey", monthKey))
    .first();

  if (monthTransactions.length === 0) {
    // No more transactions for this month, delete the summary
    if (existingSummary) {
      await ctx.db.delete(existingSummary._id);
    }
    return;
  }

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryBreakdown: Record<
    string,
    { amount: number; count: number; type: "expense" | "income" }
  > = {};

  const statementIds = [...new Set(monthTransactions.map((tx: any) => tx.statementId))];

  const sorted = [...monthTransactions].sort(
    (a: any, b: any) => a.transactionDate - b.transactionDate
  );

  const openingBalance = sorted[0].balance;
  const closingBalance = sorted[sorted.length - 1].balance;

  for (const tx of monthTransactions) {
    const category = tx.userCategoryOverride || tx.categoryId;

    if (tx.depositAmount > 0) {
      totalIncome += tx.depositAmount;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { amount: 0, count: 0, type: "income" };
      }
      categoryBreakdown[category].amount += tx.depositAmount;
      categoryBreakdown[category].count += 1;
      categoryBreakdown[category].type = "income";
    }

    if (tx.withdrawalAmount > 0) {
      totalExpenses += tx.withdrawalAmount;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { amount: 0, count: 0, type: "expense" };
      }
      categoryBreakdown[category].amount += tx.withdrawalAmount;
      categoryBreakdown[category].count += 1;
      categoryBreakdown[category].type = "expense";
    }
  }

  const summaryData = {
    monthKey,
    year,
    month,
    totalIncome,
    totalExpenses,
    netFlow: totalIncome - totalExpenses,
    transactionCount: monthTransactions.length,
    openingBalance,
    closingBalance,
    categoryBreakdown: JSON.stringify(categoryBreakdown),
    statementIds,
    lastUpdated: Date.now(),
  };

  if (existingSummary) {
    await ctx.db.patch(existingSummary._id, summaryData);
  } else {
    await ctx.db.insert("monthlySummary", summaryData);
  }
}

export const getByHash = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("statements")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.fileHash))
      .first();
  },
});
