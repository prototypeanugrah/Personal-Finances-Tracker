import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    filename: v.string(),
    statementType: v.union(v.literal("debit"), v.literal("credit")),
    accountNumber: v.string(),
    accountHolder: v.string(),
    openingBalance: v.optional(v.number()),
    closingBalance: v.optional(v.number()),
    currency: v.optional(v.string()),
    dateFrom: v.number(),
    dateTo: v.number(),
    transactionCount: v.number(),
    fileHash: v.string(),
    cashbackEarned: v.optional(v.number()),
    cashbackTransferred: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

export const importStatement = mutation({
  args: {
    statement: v.object({
      filename: v.string(),
      statementType: v.union(v.literal("debit"), v.literal("credit")),
      accountNumber: v.string(),
      accountHolder: v.string(),
      openingBalance: v.optional(v.number()),
      closingBalance: v.optional(v.number()),
      currency: v.optional(v.string()),
      dateFrom: v.number(),
      dateTo: v.number(),
      transactionCount: v.number(),
      fileHash: v.string(),
      cashbackEarned: v.optional(v.number()),
      cashbackTransferred: v.optional(v.number()),
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
        rewardPoints: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("statements")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.statement.fileHash))
      .first();

    if (existing) {
      return { statementId: existing._id, alreadyExists: true, transactionIds: [] };
    }

    const statementId = await ctx.db.insert("statements", {
      ...args.statement,
      importedAt: Date.now(),
    });

    const transactionIds = [];
    for (const tx of args.transactions) {
      const id = await ctx.db.insert("transactions", {
        ...tx,
        statementId,
        statementType: args.statement.statementType,
      });
      transactionIds.push(id);
    }

    return { statementId, alreadyExists: false, transactionIds };
  },
});

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
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.id))
      .collect();

    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const getByHash = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("statements")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.fileHash))
      .first();
  },
});
