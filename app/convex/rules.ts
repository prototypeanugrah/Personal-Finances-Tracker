import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if rules already exist
    const existing = await ctx.db.query("rules").first();
    if (existing) {
      return { seeded: false, message: "Rules already exist" };
    }

    const defaultRules = [
      // Food & Dining
      {
        priority: 10,
        categoryId: "food",
        type: "keyword",
        pattern: "MCDONALDS|MCDONALD|KFC|BURGER KING|DOMINOS|PIZZA HUT|SUBWAY",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 11,
        categoryId: "food",
        type: "keyword",
        pattern: "BIKANERVALA|HALDIRAM|SWEETS|RESTAURANT|CAFE|DHABA|FOOD",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 12,
        categoryId: "food",
        type: "keyword",
        pattern: "ZOMATO|SWIGGY|EATSURE|DUNZO",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 13,
        categoryId: "food",
        type: "keyword",
        pattern: "BIGBASKET|BLINKIT|ZEPTO|INSTAMART|GROCERY|SUPERMARKET|DMART",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 14,
        categoryId: "food",
        type: "keyword",
        pattern: "STARBUCKS|CCD|COSTA|BARISTA|TEA|CHAAYOS",
        field: "remarks",
        isSystem: true,
      },

      // Housing
      {
        priority: 20,
        categoryId: "housing",
        type: "keyword",
        pattern: "NOBROKER|RENT|HOUSING|NESTAWAY|SQUARE YARDS",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 21,
        categoryId: "housing",
        type: "keyword",
        pattern: "ELECTRICITY|BESCOM|POWER|WATER|GAS|UTILITY",
        field: "remarks",
        isSystem: true,
      },

      // Transportation
      {
        priority: 30,
        categoryId: "transport",
        type: "keyword",
        pattern: "OLA|UBER|RAPIDO|NAMMA YATRI|PORTER|MERU|TAXI|CAB",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 31,
        categoryId: "transport",
        type: "keyword",
        pattern: "PETROL|DIESEL|FUEL|HP PUMP|INDIAN OIL|BHARAT PETROLEUM",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 32,
        categoryId: "transport",
        type: "keyword",
        pattern: "METRO|RAILWAY|IRCTC|BUS|KSRTC|BMTC",
        field: "remarks",
        isSystem: true,
      },

      // Shopping
      {
        priority: 40,
        categoryId: "shopping",
        type: "keyword",
        pattern: "AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|MEESHO",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 41,
        categoryId: "shopping",
        type: "keyword",
        pattern: "CROMA|RELIANCE DIGITAL|VIJAY SALES|ELECTRONICS",
        field: "remarks",
        isSystem: true,
      },

      // Entertainment
      {
        priority: 50,
        categoryId: "entertainment",
        type: "keyword",
        pattern: "NETFLIX|PRIME VIDEO|HOTSTAR|SPOTIFY|YOUTUBE|APPLE MUSIC",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 51,
        categoryId: "entertainment",
        type: "keyword",
        pattern: "PVR|INOX|CINEPOLIS|BOOKMYSHOW|MOVIE|CINEMA",
        field: "remarks",
        isSystem: true,
      },

      // Health
      {
        priority: 60,
        categoryId: "health",
        type: "keyword",
        pattern: "APOLLO|1MG|PHARMEASY|NETMEDS|HOSPITAL|CLINIC|MEDICAL|PHARMACY",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 61,
        categoryId: "health",
        type: "keyword",
        pattern: "CULT|GYMFIT|FITNESS|GYM|YOGA",
        field: "remarks",
        isSystem: true,
      },

      // Income indicators (for deposits)
      {
        priority: 5,
        categoryId: "income",
        type: "deposit",
        pattern: "SALARY|CREDIT|REFUND|CASHBACK|REWARD",
        field: "remarks",
        isSystem: true,
      },

      // Transfers
      {
        priority: 70,
        categoryId: "transfers",
        type: "keyword",
        pattern: "TRANSFER|SELF|SAVINGS",
        field: "remarks",
        isSystem: true,
      },
    ];

    for (const rule of defaultRules) {
      await ctx.db.insert("rules", rule);
    }

    return { seeded: true, count: defaultRules.length };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("rules")
      .withIndex("by_priority")
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    priority: v.number(),
    categoryId: v.string(),
    type: v.string(),
    pattern: v.string(),
    field: v.string(),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("rules", {
      ...args,
      isSystem: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("rules"),
    priority: v.optional(v.number()),
    categoryId: v.optional(v.string()),
    type: v.optional(v.string()),
    pattern: v.optional(v.string()),
    field: v.optional(v.string()),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
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
  args: { id: v.id("rules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (rule?.isSystem) {
      throw new Error("Cannot delete system rule");
    }
    await ctx.db.delete(args.id);
  },
});
