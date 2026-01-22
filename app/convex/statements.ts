import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    // Delete all transactions for this statement
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.id))
      .collect();

    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    // Delete the statement
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
