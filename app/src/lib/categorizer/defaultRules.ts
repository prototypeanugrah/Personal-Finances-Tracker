import type { CategorizationRule } from "./categoryEngine";

/**
 * Default categorization rules for Indian transactions
 * These are used when Convex rules are not yet loaded
 */
export const defaultRules: CategorizationRule[] = [
  // Food & Dining - Fast Food
  {
    priority: 10,
    categoryId: "food",
    type: "keyword",
    pattern: "MCDONALDS|MCDONALD|KFC|BURGER KING|DOMINOS|PIZZA HUT|SUBWAY",
    field: "remarks",
  },

  // Food & Dining - Indian Restaurants
  {
    priority: 11,
    categoryId: "food",
    type: "keyword",
    pattern: "BIKANERVALA|HALDIRAM|SWEETS|RESTAURANT|CAFE|DHABA|FOOD",
    field: "remarks",
  },

  // Food & Dining - Delivery Apps
  {
    priority: 12,
    categoryId: "food",
    type: "keyword",
    pattern: "ZOMATO|SWIGGY|EATSURE|DUNZO|BREAD BASK",
    field: "remarks",
  },

  // Food & Dining - Groceries
  {
    priority: 13,
    categoryId: "food",
    type: "keyword",
    pattern: "BIGBASKET|BLINKIT|ZEPTO|INSTAMART|GROCERY|SUPERMARKET|DMART|AIBA BAZAA",
    field: "remarks",
  },

  // Food & Dining - Cafes & Beverages
  {
    priority: 14,
    categoryId: "food",
    type: "keyword",
    pattern: "STARBUCKS|CCD|COSTA|BARISTA|TEA|CHAAYOS|KEVENTERS|TEA FOO",
    field: "remarks",
  },

  // Housing - Rent & Property
  {
    priority: 20,
    categoryId: "housing",
    type: "keyword",
    pattern: "NOBROKER|RENT|HOUSING|NESTAWAY|SQUARE YARDS|SQUARE YAR|FURLENCO",
    field: "remarks",
  },

  // Housing - Utilities
  {
    priority: 21,
    categoryId: "housing",
    type: "keyword",
    pattern: "ELECTRICITY|BESCOM|POWER|WATER|GAS|UTILITY",
    field: "remarks",
  },

  // Transportation - Cabs & Rides
  {
    priority: 30,
    categoryId: "transport",
    type: "keyword",
    pattern: "OLA|UBER|RAPIDO|NAMMA YATRI|PORTER|MERU|TAXI|CAB",
    field: "remarks",
  },

  // Transportation - Fuel
  {
    priority: 31,
    categoryId: "transport",
    type: "keyword",
    pattern: "PETROL|DIESEL|FUEL|HP PUMP|INDIAN OIL|BHARAT PETROLEUM",
    field: "remarks",
  },

  // Transportation - Public Transport
  {
    priority: 32,
    categoryId: "transport",
    type: "keyword",
    pattern: "METRO|RAILWAY|IRCTC|BUS|KSRTC|BMTC",
    field: "remarks",
  },

  // Shopping - Online
  {
    priority: 40,
    categoryId: "shopping",
    type: "keyword",
    pattern: "AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|MEESHO",
    field: "remarks",
  },

  // Shopping - Electronics
  {
    priority: 41,
    categoryId: "shopping",
    type: "keyword",
    pattern: "CROMA|RELIANCE DIGITAL|VIJAY SALES|ELECTRONICS",
    field: "remarks",
  },

  // Entertainment - Streaming
  {
    priority: 50,
    categoryId: "entertainment",
    type: "keyword",
    pattern: "NETFLIX|PRIME VIDEO|HOTSTAR|SPOTIFY|YOUTUBE|APPLE MUSIC",
    field: "remarks",
  },

  // Entertainment - Movies
  {
    priority: 51,
    categoryId: "entertainment",
    type: "keyword",
    pattern: "PVR|INOX|CINEPOLIS|BOOKMYSHOW|MOVIE|CINEMA",
    field: "remarks",
  },

  // Health - Medical
  {
    priority: 60,
    categoryId: "health",
    type: "keyword",
    pattern: "APOLLO|1MG|PHARMEASY|NETMEDS|HOSPITAL|CLINIC|MEDICAL|PHARMACY",
    field: "remarks",
  },

  // Health - Fitness
  {
    priority: 61,
    categoryId: "health",
    type: "keyword",
    pattern: "CULT|GYMFIT|FITNESS|GYM|YOGA",
    field: "remarks",
  },

  // Income - Deposits (should match deposits with specific keywords)
  {
    priority: 5,
    categoryId: "income",
    type: "deposit",
    pattern: "SALARY|CREDIT|REFUND|CASHBACK|REWARD|FUNDS TRANSFER|FAMILY",
    field: "remarks",
  },

  // Transfers - Self & Family
  {
    priority: 70,
    categoryId: "transfers",
    type: "keyword",
    pattern: "TRANSFER|SELF|SAVINGS|FAMILY",
    field: "remarks",
  },
];

/**
 * Default category definitions
 */
export const defaultCategories = [
  { id: "food", name: "Food & Dining", icon: "🍽️", color: "#FF6B6B" },
  { id: "housing", name: "Housing", icon: "🏠", color: "#4ECDC4" },
  { id: "transport", name: "Transportation", icon: "🚗", color: "#45B7D1" },
  { id: "shopping", name: "Shopping", icon: "🛍️", color: "#96CEB4" },
  { id: "entertainment", name: "Entertainment", icon: "🎬", color: "#FFEAA7" },
  { id: "health", name: "Health", icon: "🏥", color: "#DDA0DD" },
  { id: "transfers", name: "Transfers", icon: "💸", color: "#B0B0B0" },
  { id: "income", name: "Income", icon: "💰", color: "#2ECC71" },
  { id: "uncategorized", name: "Uncategorized", icon: "❓", color: "#95A5A6" },
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string) {
  return defaultCategories.find((c) => c.id === id) || defaultCategories[defaultCategories.length - 1];
}
