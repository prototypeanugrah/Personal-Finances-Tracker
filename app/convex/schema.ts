import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  statements: defineTable({
    filename: v.string(),
    statementType: v.optional(v.union(v.literal("debit"), v.literal("credit"))),
    importedAt: v.number(),
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
  }).index("by_hash", ["fileHash"]),

  transactions: defineTable({
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
    statementType: v.optional(v.union(v.literal("debit"), v.literal("credit"))),
    rewardPoints: v.optional(v.number()),
    userCategoryOverride: v.optional(v.string()),
    userNotes: v.optional(v.string()),
  })
    .index("by_date", ["transactionDate"])
    .index("by_category", ["categoryId"])
    .index("by_statement", ["statementId"]),

  rules: defineTable({
    priority: v.number(),
    categoryId: v.string(),
    type: v.string(),
    pattern: v.string(),
    field: v.string(),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
    isSystem: v.boolean(),
  }).index("by_priority", ["priority"]),
});
