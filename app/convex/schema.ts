import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  statements: defineTable({
    filename: v.string(),
    importedAt: v.number(),
    accountNumber: v.string(),
    accountHolder: v.string(),
    dateFrom: v.number(),
    dateTo: v.number(),
    transactionCount: v.number(),
    fileHash: v.string(),
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
    userCategoryOverride: v.optional(v.string()),
    userNotes: v.optional(v.string()),
  })
    .index("by_date", ["transactionDate"])
    .index("by_category", ["categoryId"])
    .index("by_statement", ["statementId"]),

  categories: defineTable({
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    parentId: v.optional(v.string()),
    isSystem: v.boolean(),
  }),

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
