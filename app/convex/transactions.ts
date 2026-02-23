import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const batchInsert = mutation({
  args: {
    transactions: v.array(
      v.object({
        statementId: v.id("statements"),
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
        statementType: v.union(v.literal("debit"), v.literal("credit")),
        rewardPoints: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const tx of args.transactions) {
      const id = await ctx.db.insert("transactions", tx);
      ids.push(id);
    }
    return ids;
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    categoryId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("transactions").withIndex("by_date").order("desc");

    const results = await q.collect();

    let filtered = results;
    if (args.categoryId) {
      filtered = results.filter((tx) => {
        const effectiveCategory = tx.userCategoryOverride || tx.categoryId;
        return effectiveCategory === args.categoryId;
      });
    }

    if (args.limit) {
      return filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

export const getByStatement = query({
  args: { statementId: v.id("statements") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();
  },
});

export const getByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .collect();

    return all.filter(
      (tx) =>
        tx.transactionDate >= args.startDate &&
        tx.transactionDate <= args.endDate
    );
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("transactions"),
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      userCategoryOverride: args.categoryId,
    });
  },
});

export const batchUpdateCategoryIds = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("transactions"),
        categoryId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0;
    let skipped = 0;

    for (const update of args.updates) {
      const transaction = await ctx.db.get(update.id);
      if (!transaction) {
        skipped += 1;
        continue;
      }

      if (transaction.categoryId === update.categoryId) {
        skipped += 1;
        continue;
      }

      await ctx.db.patch(update.id, {
        categoryId: update.categoryId,
      });
      updated += 1;
    }

    return { updated, skipped };
  },
});

export const updateNotes = mutation({
  args: {
    id: v.id("transactions"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      userNotes: args.notes,
    });
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();

    const totalExpenses = transactions.reduce(
      (sum, tx) => sum + tx.withdrawalAmount,
      0
    );
    const totalIncome = transactions.reduce(
      (sum, tx) => sum + tx.depositAmount,
      0
    );

    // Group by category
    const byCategory: Record<
      string,
      { expenses: number; income: number; count: number }
    > = {};

    for (const tx of transactions) {
      const cat = tx.userCategoryOverride || tx.categoryId;
      if (!byCategory[cat]) {
        byCategory[cat] = { expenses: 0, income: 0, count: 0 };
      }
      byCategory[cat].expenses += tx.withdrawalAmount;
      byCategory[cat].income += tx.depositAmount;
      byCategory[cat].count += 1;
    }

    return {
      totalExpenses,
      totalIncome,
      netFlow: totalIncome - totalExpenses,
      transactionCount: transactions.length,
      byCategory,
    };
  },
});

export const getMonthlySummary = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .collect();

    const monthly: Record<
      string,
      { expenses: number; income: number; month: string }
    > = {};

    for (const tx of transactions) {
      const date = new Date(tx.transactionDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthly[key]) {
        monthly[key] = {
          expenses: 0,
          income: 0,
          month: key,
        };
      }

      monthly[key].expenses += tx.withdrawalAmount;
      monthly[key].income += tx.depositAmount;
    }

    return Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));
  },
});
