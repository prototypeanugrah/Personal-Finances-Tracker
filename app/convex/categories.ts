import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if categories already exist
    const existing = await ctx.db.query("categories").first();
    if (existing) {
      return { seeded: false, message: "Categories already exist" };
    }

    const defaultCategories = [
      { name: "Food & Dining", icon: "🍽️", color: "#FF6B6B", isSystem: true },
      {
        name: "Restaurants",
        icon: "🍔",
        color: "#FF6B6B",
        parentId: "food",
        isSystem: true,
      },
      {
        name: "Groceries",
        icon: "🛒",
        color: "#FF8E8E",
        parentId: "food",
        isSystem: true,
      },
      {
        name: "Cafes",
        icon: "☕",
        color: "#FFB3B3",
        parentId: "food",
        isSystem: true,
      },
      { name: "Housing", icon: "🏠", color: "#4ECDC4", isSystem: true },
      {
        name: "Rent",
        icon: "🔑",
        color: "#4ECDC4",
        parentId: "housing",
        isSystem: true,
      },
      {
        name: "Utilities",
        icon: "💡",
        color: "#6EE7DF",
        parentId: "housing",
        isSystem: true,
      },
      { name: "Transportation", icon: "🚗", color: "#45B7D1", isSystem: true },
      {
        name: "Cab/Taxi",
        icon: "🚕",
        color: "#45B7D1",
        parentId: "transport",
        isSystem: true,
      },
      {
        name: "Fuel",
        icon: "⛽",
        color: "#67C9E0",
        parentId: "transport",
        isSystem: true,
      },
      { name: "Shopping", icon: "🛍️", color: "#96CEB4", isSystem: true },
      {
        name: "Clothing",
        icon: "👕",
        color: "#96CEB4",
        parentId: "shopping",
        isSystem: true,
      },
      {
        name: "Electronics",
        icon: "📱",
        color: "#A8D8C5",
        parentId: "shopping",
        isSystem: true,
      },
      { name: "Entertainment", icon: "🎬", color: "#FFEAA7", isSystem: true },
      {
        name: "Movies",
        icon: "🎥",
        color: "#FFEAA7",
        parentId: "entertainment",
        isSystem: true,
      },
      {
        name: "Streaming",
        icon: "📺",
        color: "#FFF0B3",
        parentId: "entertainment",
        isSystem: true,
      },
      { name: "Health", icon: "🏥", color: "#DDA0DD", isSystem: true },
      {
        name: "Medical",
        icon: "💊",
        color: "#DDA0DD",
        parentId: "health",
        isSystem: true,
      },
      {
        name: "Fitness",
        icon: "🏋️",
        color: "#E8B8E8",
        parentId: "health",
        isSystem: true,
      },
      { name: "Transfers", icon: "💸", color: "#B0B0B0", isSystem: true },
      {
        name: "Family",
        icon: "👨‍👩‍👧",
        color: "#B0B0B0",
        parentId: "transfers",
        isSystem: true,
      },
      {
        name: "Friends",
        icon: "🤝",
        color: "#C0C0C0",
        parentId: "transfers",
        isSystem: true,
      },
      { name: "Income", icon: "💰", color: "#2ECC71", isSystem: true },
      {
        name: "Salary",
        icon: "💵",
        color: "#2ECC71",
        parentId: "income",
        isSystem: true,
      },
      {
        name: "Refunds",
        icon: "↩️",
        color: "#58D68D",
        parentId: "income",
        isSystem: true,
      },
      { name: "Uncategorized", icon: "❓", color: "#95A5A6", isSystem: true },
    ];

    for (const cat of defaultCategories) {
      await ctx.db.insert("categories", cat);
    }

    return { seeded: true, count: defaultCategories.length };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

export const get = query({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("categories", {
      ...args,
      isSystem: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (category?.isSystem) {
      throw new Error("Cannot delete system category");
    }
    await ctx.db.delete(args.id);
  },
});
