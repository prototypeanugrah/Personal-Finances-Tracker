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
      // Income (deposits)
      {
        priority: 1,
        categoryId: "salary",
        type: "deposit",
        pattern: "SALARY|PAYROLL|PAY CREDIT|SAL CREDIT|COMPANY CREDIT",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 2,
        categoryId: "refunds",
        type: "deposit",
        pattern: "REFUND|REVERSAL|CASHBACK|REWARD|REIMBURSEMENT|FAILED TXN",
        field: "remarks",
        isSystem: true,
      },

      // Food
      {
        priority: 10,
        categoryId: "restaurants",
        type: "keyword",
        pattern:
          "ZOMATO|SWIGGY|EATSURE|FAASOS|BOX8|BURGER KING|KFC|MCDONALDS|DOMINOS|PIZZA HUT|SUBWAY",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 11,
        categoryId: "groceries",
        type: "keyword",
        pattern:
          "BIGBASKET|BLINKIT|ZEPTO|INSTAMART|GROCERY|SUPERMARKET|DMART|RELIANCE FRESH|MORE|SPENCERS|NATURES BASKET",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 12,
        categoryId: "cafes",
        type: "keyword",
        pattern:
          "STARBUCKS|CCD|CAFE COFFEE DAY|COSTA|BARISTA|CHAAYOS|BLUE TOKAI|THIRD WAVE|COFFEE",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 20,
        categoryId: "restaurants",
        type: "keyword",
        pattern: "RESTAURANT|EATERY|DHABA|BISTRO",
        field: "remarks",
        isSystem: true,
      },

      // Housing
      {
        priority: 30,
        categoryId: "rent",
        type: "keyword",
        pattern:
          "RENT|HOUSE RENT|NOBROKER|NESTAWAY|HOUSING|APARTMENT|LANDLORD|PROPERTY MANAGEMENT",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 31,
        categoryId: "utilities",
        type: "keyword",
        pattern:
          "ELECTRICITY|POWER BILL|WATER BILL|GAS BILL|UTILITY|BESCOM|BROADBAND|AIRTEL FIBER|JIO FIBER|ACT FIBERNET|DTH",
        field: "remarks",
        isSystem: true,
      },

      // Transportation
      {
        priority: 40,
        categoryId: "fuel",
        type: "keyword",
        pattern: "PETROL|DIESEL|FUEL|HPCL|INDIAN OIL|BHARAT PETROLEUM|SHELL",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 41,
        categoryId: "transport",
        type: "keyword",
        pattern: "METRO|RAILWAY|IRCTC|BUS|KSRTC|BMTC|REDBUS|AIRINDIA|OLA|UBER|RAPIDO|NAMMA YATRI|TAXI|CAB|AUTO RIDE|MERU|PORTER",
        field: "remarks",
        isSystem: true,
      },

      // Shopping
      {
        priority: 50,
        categoryId: "clothing",
        type: "keyword",
        pattern:
          "MYNTRA|AJIO|H&M|HM|ZARA|WESTSIDE|PANTALOONS|MAX FASHION|SHOPPERS STOP",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 51,
        categoryId: "electronics",
        type: "keyword",
        pattern: "CROMA|RELIANCE DIGITAL|VIJAY SALES|APPLE|SAMSUNG|MI STORE|ELECTRONICS",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 52,
        categoryId: "shopping",
        type: "keyword",
        pattern: "AMAZON|FLIPKART|NYKAA|MEESHO|SHOPPING",
        field: "remarks",
        isSystem: true,
      },

      // Entertainment
      {
        priority: 60,
        categoryId: "streaming",
        type: "keyword",
        pattern:
          "NETFLIX|PRIME VIDEO|HOTSTAR|DISNEY|SPOTIFY|YOUTUBE|APPLE MUSIC|JIO CINEMA|SONY LIV|ZEE5",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 61,
        categoryId: "movies",
        type: "keyword",
        pattern: "PVR|INOX|CINEPOLIS|BOOKMYSHOW|MOVIE|CINEMA",
        field: "remarks",
        isSystem: true,
      },

      // Health
      {
        priority: 70,
        categoryId: "medical",
        type: "keyword",
        pattern:
          "APOLLO|1MG|PHARMEASY|NETMEDS|HOSPITAL|CLINIC|MEDICAL|PHARMACY|PRACTO|LABS",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 71,
        categoryId: "fitness",
        type: "keyword",
        pattern: "CULT|FITNESS|GYM|YOGA|FITPASS|HEALTH CLUB",
        field: "remarks",
        isSystem: true,
      },

      // Transfers
      {
        priority: 80,
        categoryId: "family",
        type: "keyword",
        pattern: "FAMILY|MOTHER|FATHER|MOM|DAD|SISTER|BROTHER|HOME TRANSFER",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 81,
        categoryId: "friends",
        type: "keyword",
        pattern: "FRIEND|SETTLEMENT|SPLITWISE|PAYBACK",
        field: "remarks",
        isSystem: true,
      },
      {
        priority: 90,
        categoryId: "transfers",
        type: "keyword",
        pattern: "TRANSFER|SELF|SAVINGS|IMPS|NEFT|ATM|CASH WITHDRAWAL|CHEQUE|CHQ",
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
