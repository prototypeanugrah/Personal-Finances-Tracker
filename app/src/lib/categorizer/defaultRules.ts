import type { CategorizationRule } from "./categoryEngine";

/**
 * Default categorization rules for Indian transactions.
 * Rules are intentionally subcategory-first so we can use the full taxonomy.
 * These are used when Convex rules are not yet loaded
 */
export const defaultRules: CategorizationRule[] = [
  // Income (deposits)
  {
    priority: 1,
    categoryId: "salary",
    type: "deposit",
    pattern: "SALARY|PAYROLL|PAY CREDIT|SAL CREDIT|COMPANY CREDIT",
    field: "remarks",
  },
  {
    priority: 2,
    categoryId: "refunds",
    type: "deposit",
    pattern: "REFUND|REVERSAL|CASHBACK|REWARD|REIMBURSEMENT|FAILED TXN",
    field: "remarks",
  },

  // Food
  {
    priority: 10,
    categoryId: "food",
    type: "keyword",
    pattern:
      "ZOMATO|SWIGGY|EATSURE|FAASOS|BOX8|BURGER KING|KFC|MCDONALDS|DOMINOS|PIZZA HUT|SUBWAY|RESTAURANT|EATERY|DHABA|BISTRO|BIKANERVAL|Swiggy",
    field: "remarks",
  },
  {
    priority: 11,
    categoryId: "groceries",
    type: "keyword",
    pattern:
      "BIGBASKET|BLINKIT|ZEPTO|INSTAMART|GROCERY|SUPERMARKET|DMART|RELIANCE FRESH|MORE|SPENCERS|NATURES BASKET",
    field: "remarks",
  },
  {
    priority: 12,
    categoryId: "cafes",
    type: "keyword",
    pattern:
      "STARBUCKS|CCD|CAFE COFFEE DAY|COSTA|BARISTA|CHAAYOS|BLUE TOKAI|THIRD WAVE|COFFEE",
    field: "remarks",
  },

  // Housing
  {
    priority: 30,
    categoryId: "rent",
    type: "keyword",
    pattern:
      "RENT|HOUSE RENT|NOBROKER|NESTAWAY|HOUSING|APARTMENT|LANDLORD|PROPERTY MANAGEMENT",
    field: "remarks",
  },
  {
    priority: 31,
    categoryId: "utilities",
    type: "keyword",
    pattern:
      "ELECTRICITY|POWER BILL|WATER BILL|GAS BILL|UTILITY|BESCOM|BROADBAND|AIRTEL FIBER|JIO FIBER|ACT FIBERNET|DTH|AIRTEL",
    field: "remarks",
  },

  // Transportation
  {
    priority: 40,
    categoryId: "fuel",
    type: "keyword",
    pattern: "PETROL|DIESEL|FUEL|HPCL|INDIAN OIL|BHARAT PETROLEUM|SHELL",
    field: "remarks",
  },
  {
    priority: 41,
    categoryId: "transport",
    type: "keyword",
    pattern: "METRO|RAILWAY|IRCTC|BUS|KSRTC|BMTC|REDBUS|AIRINDIA|OLA|UBER|RAPIDO|NAMMA YATRI|TAXI|CAB|AUTO RIDE|MERU|PORTER",
    field: "remarks",
  },

  // Shopping
  {
    priority: 50,
    categoryId: "electronics",
    type: "keyword",
    pattern:
      "CROMA|RELIANCE DIGITAL|VIJAY SALES|APPLE|SAMSUNG|MI STORE|ELECTRONICS",
    field: "remarks",
  },
  {
    priority: 51,
    categoryId: "shopping",
    type: "keyword",
    pattern: "AMAZON|FLIPKART|NYKAA|MEESHO|SHOPPING|MYNTRA|AJIO|H&M|HM|ZARA|WESTSIDE|PANTALOONS|MAX FASHION|SHOPPERS STOP",
    field: "remarks",
  },

  // Entertainment
  {
    priority: 60,
    categoryId: "streaming",
    type: "keyword",
    pattern:
      "NETFLIX|PRIME VIDEO|HOTSTAR|DISNEY|SPOTIFY|YOUTUBE|APPLE MUSIC|JIO CINEMA|SONY LIV|ZEE5",
    field: "remarks",
  },
  {
    priority: 61,
    categoryId: "movies",
    type: "keyword",
    pattern: "PVR|INOX|CINEPOLIS|BOOKMYSHOW|MOVIE|CINEMA",
    field: "remarks",
  },

  // Health
  {
    priority: 70,
    categoryId: "medical",
    type: "keyword",
    pattern:
      "APOLLO|1MG|PHARMEASY|NETMEDS|HOSPITAL|CLINIC|MEDICAL|PHARMACY|PRACTO|LABS",
    field: "remarks",
  },
  {
    priority: 71,
    categoryId: "fitness",
    type: "keyword",
    pattern: "CULT|FITNESS|GYM|YOGA|FITPASS|HEALTH CLUB",
    field: "remarks",
  },

  // Transfers
  {
    priority: 80,
    categoryId: "family",
    type: "keyword",
    pattern: "FAMILY|MOTHER|FATHER|MOM|DAD|SISTER|BROTHER|HOME TRANSFER",
    field: "remarks",
  },
  {
    priority: 81,
    categoryId: "friends",
    type: "keyword",
    pattern: "FRIEND|SETTLEMENT|SPLITWISE|PAYBACK",
    field: "remarks",
  },
  {
    priority: 90,
    categoryId: "transfers",
    type: "keyword",
    pattern: "TRANSFER|SELF|SAVINGS|IMPS|NEFT|ATM|CASH WITHDRAWAL|CHEQUE|CHQ",
    field: "remarks",
  },
];

/**
 * Default category definitions
 */
export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId?: string;
}

export const defaultCategories: CategoryDefinition[] = [
  { id: "food", name: "Restaurants", icon: "🍔", color: "#FF6B6B", parentId: "food" },
  { id: "groceries", name: "Groceries", icon: "🛒", color: "#FF8E8E", parentId: "food" },
  { id: "cafes", name: "Cafes", icon: "☕", color: "#FFB3B3", parentId: "food" },

  { id: "housing", name: "Housing", icon: "🏠", color: "#4ECDC4" },
  { id: "rent", name: "Rent", icon: "🔑", color: "#4ECDC4", parentId: "housing" },
  { id: "utilities", name: "Utilities", icon: "💡", color: "#6EE7DF", parentId: "housing" },

  { id: "transport", name: "Transportation", icon: "🚗", color: "#45B7D1" },
  { id: "fuel", name: "Fuel", icon: "⛽", color: "#67C9E0", parentId: "transport" },

  { id: "shopping", name: "Shopping", icon: "🛍️", color: "#96CEB4" },
  { id: "electronics", name: "Electronics", icon: "📱", color: "#A8D8C5", parentId: "shopping" },

  { id: "entertainment", name: "Entertainment", icon: "🎬", color: "#FFEAA7" },
  { id: "movies", name: "Movies", icon: "🎥", color: "#FFEAA7", parentId: "entertainment" },
  { id: "streaming", name: "Streaming", icon: "📺", color: "#FFF0B3", parentId: "entertainment" },

  { id: "health", name: "Health", icon: "🏥", color: "#DDA0DD" },
  { id: "medical", name: "Medical", icon: "💊", color: "#DDA0DD", parentId: "health" },
  { id: "fitness", name: "Fitness", icon: "🏋️", color: "#E8B8E8", parentId: "health" },

  { id: "transfers", name: "Transfers", icon: "💸", color: "#B0B0B0" },
  { id: "family", name: "Family", icon: "👨‍👩‍👧", color: "#B0B0B0", parentId: "transfers" },
  { id: "friends", name: "Friends", icon: "🤝", color: "#C0C0C0", parentId: "transfers" },

  { id: "income", name: "Income", icon: "💰", color: "#2ECC71" },
  { id: "salary", name: "Salary", icon: "💵", color: "#2ECC71", parentId: "income" },
  { id: "refunds", name: "Refunds", icon: "↩️", color: "#58D68D", parentId: "income" },

  { id: "uncategorized", name: "Uncategorized", icon: "❓", color: "#95A5A6" },
];

const categoryById = new Map(defaultCategories.map((category) => [category.id, category]));

/**
 * Get category by ID
 */
export function getCategoryById(id: string) {
  return categoryById.get(id) || defaultCategories[defaultCategories.length - 1];
}
