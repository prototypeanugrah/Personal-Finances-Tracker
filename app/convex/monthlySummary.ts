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

// Get summary for a specific month
export const get = query({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("monthlySummary")
      .withIndex("by_month", (q) => q.eq("monthKey", args.monthKey))
      .first();

    if (!summary) return null;

    return {
      ...summary,
      categoryBreakdown: JSON.parse(summary.categoryBreakdown),
    };
  },
});

// List all monthly summaries
export const list = query({
  args: {},
  handler: async (ctx) => {
    const summaries = await ctx.db
      .query("monthlySummary")
      .withIndex("by_month")
      .order("desc")
      .collect();

    return summaries.map((summary) => ({
      ...summary,
      categoryBreakdown: JSON.parse(summary.categoryBreakdown),
    }));
  },
});

// Get summaries for a specific year
export const getByYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const summaries = await ctx.db
      .query("monthlySummary")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect();

    return summaries
      .map((summary) => ({
        ...summary,
        categoryBreakdown: JSON.parse(summary.categoryBreakdown),
      }))
      .sort((a, b) => a.month - b.month);
  },
});

// List available months (just the month keys for dropdown)
export const listMonths = query({
  args: {},
  handler: async (ctx) => {
    const summaries = await ctx.db
      .query("monthlySummary")
      .withIndex("by_month")
      .order("desc")
      .collect();

    return summaries.map((s) => ({
      monthKey: s.monthKey,
      year: s.year,
      month: s.month,
      transactionCount: s.transactionCount,
    }));
  },
});

// Upsert monthly summary - called when importing statements
export const upsert = mutation({
  args: {
    monthKey: v.string(),
    statementId: v.id("statements"),
  },
  handler: async (ctx, args) => {
    const { year, month } = parseMonthKey(args.monthKey);

    // Get all transactions for this month
    const allTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .collect();

    // Filter to this month's transactions
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const monthTransactions = allTransactions.filter(
      (tx) => tx.transactionDate >= monthStart && tx.transactionDate <= monthEnd
    );

    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdown: Record<
      string,
      { amount: number; count: number; type: "expense" | "income" }
    > = {};

    // Sort by date to get opening/closing balance
    const sorted = [...monthTransactions].sort(
      (a, b) => a.transactionDate - b.transactionDate
    );

    const openingBalance = sorted.length > 0 ? sorted[0].balance : 0;
    const closingBalance =
      sorted.length > 0 ? sorted[sorted.length - 1].balance : 0;

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
    const existing = await ctx.db
      .query("monthlySummary")
      .withIndex("by_month", (q) => q.eq("monthKey", args.monthKey))
      .first();

    const statementIds = existing
      ? [...new Set([...existing.statementIds, args.statementId])]
      : [args.statementId];

    const summaryData = {
      monthKey: args.monthKey,
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

    if (existing) {
      await ctx.db.patch(existing._id, summaryData);
      return existing._id;
    } else {
      return await ctx.db.insert("monthlySummary", summaryData);
    }
  },
});

// Recalculate summary from transactions (for manual fixes/corrections)
export const recalculate = mutation({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const { year, month } = parseMonthKey(args.monthKey);

    // Get all transactions for this month
    const allTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .collect();

    // Filter to this month's transactions
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const monthTransactions = allTransactions.filter(
      (tx) => tx.transactionDate >= monthStart && tx.transactionDate <= monthEnd
    );

    if (monthTransactions.length === 0) {
      // Delete the summary if no transactions exist
      const existing = await ctx.db
        .query("monthlySummary")
        .withIndex("by_month", (q) => q.eq("monthKey", args.monthKey))
        .first();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdown: Record<
      string,
      { amount: number; count: number; type: "expense" | "income" }
    > = {};

    // Get unique statement IDs from transactions
    const statementIds = [
      ...new Set(monthTransactions.map((tx) => tx.statementId)),
    ];

    // Sort by date to get opening/closing balance
    const sorted = [...monthTransactions].sort(
      (a, b) => a.transactionDate - b.transactionDate
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
      monthKey: args.monthKey,
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

    const existing = await ctx.db
      .query("monthlySummary")
      .withIndex("by_month", (q) => q.eq("monthKey", args.monthKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, summaryData);
      return existing._id;
    } else {
      return await ctx.db.insert("monthlySummary", summaryData);
    }
  },
});

// Recalculate all monthly summaries (bulk operation)
export const recalculateAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all transactions
    const allTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .collect();

    // Group by month
    const byMonth: Record<string, typeof allTransactions> = {};

    for (const tx of allTransactions) {
      const date = new Date(tx.transactionDate);
      const monthKey = formatMonthKey(
        date.getFullYear(),
        date.getMonth() + 1
      );

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = [];
      }
      byMonth[monthKey].push(tx);
    }

    // Delete all existing summaries
    const existingSummaries = await ctx.db
      .query("monthlySummary")
      .collect();

    for (const summary of existingSummaries) {
      await ctx.db.delete(summary._id);
    }

    // Create new summaries for each month
    const results: string[] = [];

    for (const [monthKey, transactions] of Object.entries(byMonth)) {
      const { year, month } = parseMonthKey(monthKey);

      let totalIncome = 0;
      let totalExpenses = 0;
      const categoryBreakdown: Record<
        string,
        { amount: number; count: number; type: "expense" | "income" }
      > = {};

      const statementIds = [...new Set(transactions.map((tx) => tx.statementId))];

      const sorted = [...transactions].sort(
        (a, b) => a.transactionDate - b.transactionDate
      );

      const openingBalance = sorted[0].balance;
      const closingBalance = sorted[sorted.length - 1].balance;

      for (const tx of transactions) {
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

      await ctx.db.insert("monthlySummary", {
        monthKey,
        year,
        month,
        totalIncome,
        totalExpenses,
        netFlow: totalIncome - totalExpenses,
        transactionCount: transactions.length,
        openingBalance,
        closingBalance,
        categoryBreakdown: JSON.stringify(categoryBreakdown),
        statementIds,
        lastUpdated: Date.now(),
      });

      results.push(monthKey);
    }

    return results;
  },
});

// Delete summary when statement is removed
export const removeStatement = mutation({
  args: { statementId: v.id("statements") },
  handler: async (ctx, args) => {
    // Find all summaries that reference this statement
    const summaries = await ctx.db.query("monthlySummary").collect();

    for (const summary of summaries) {
      if (summary.statementIds.includes(args.statementId)) {
        const newStatementIds = summary.statementIds.filter(
          (id) => id !== args.statementId
        );

        if (newStatementIds.length === 0) {
          // No more statements for this month, delete the summary
          await ctx.db.delete(summary._id);
        } else {
          // Update the summary to remove this statement and recalculate
          await ctx.db.patch(summary._id, {
            statementIds: newStatementIds,
          });
        }
      }
    }
  },
});
