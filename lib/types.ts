// TypeScript types for JSON structures stored in UserProfile

// ==================== Chef Intake Types ====================

export type CookingSkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface Goal {
  id: string;
  name: string;
  description?: string;
}

export interface DietStyle {
  id: string;
  name: string;
  description?: string;
}

export interface Allergy {
  id: string;
  name: string;
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
}

export interface Restriction {
  id: string;
  description: string;
}

export interface Portions {
  id: string;
  peopleCount: number;
  adultPortionNote?: string;
  kidPortionNote?: string;
}

export interface Favorite {
  id: string;
  title: string;
  notes?: string;
}

export interface Dislike {
  id: string;
  item: string;
  notes?: string;
}

export interface Cuisine {
  id: string;
  cuisine: string;
  level: "LOVE" | "LIKE" | "NEUTRAL" | "DISLIKE";
}

export interface Flavor {
  id: string;
  note: string;
  level: "LOW" | "MEDIUM" | "HIGH";
}

export interface Schedule {
  id: string;
  usualDinnerTime?: string;
  quickNights?: string[];
  mealPrepStyle: string;
  preferredStartDay: string;
}

export interface NutritionGoal {
  id: string;
  goalType: string;
}

export interface Kitchen {
  id: string;
  equipment: string[];
  extraNotes?: string;
}

export interface Sourcing {
  id: string;
  organicPreferred?: boolean;
  localPreferred?: boolean;
  budget: "LOW" | "MEDIUM" | "HIGH";
  otherNotes?: string;
}

export interface Store {
  id: string;
  name: string;
  notes?: string;
}

export interface Beverages {
  id: string;
  doPairings: boolean;
  alcoholOk?: boolean;
  wineNotes?: string;
  mocktailNotes?: string;
}

export interface Desserts {
  id: string;
  sweetTooth: "LOW" | "MEDIUM" | "HIGH";
  favoriteDesserts?: string;
}

export interface Occasion {
  id: string;
  name: string;
  month?: number;
  day?: number;
  notes?: string;
}

export interface ChefIntake {
  id: string;
  currentCookingFrequency?: number;
  desiredCookingFrequency: number;
  cookingSkillLevel: CookingSkillLevel;
  maxCookingTime: number;
  goals: Goal[];
  dietStyles: DietStyle[];
  allergies: Allergy[];
  restrictions: Restriction[];
  portions?: Portions;
  favorites: Favorite[];
  dislikes: Dislike[];
  cuisines: Cuisine[];
  flavors: Flavor[];
  schedule?: Schedule;
  nutritionGoals?: NutritionGoal[];
  kitchen?: Kitchen;
  sourcing?: Sourcing;
  stores?: Store[];
  beverages?: Beverages;
  desserts?: Desserts;
  occasions?: Occasion[];
  completedBasicOnboarding: boolean;
  completedAdvancedOnboarding: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Inventory Types ====================

export type InventoryLocation = "pantry" | "fridge" | "freezer";

export interface InventoryItem {
  id: string;
  name: string;
  canonicalId?: string;
  location: InventoryLocation;
  quantity: number;
  unit: string;
  expiresAt?: string;
  photoUri?: string;
  addedAt: string;
}

// ==================== Meal Plan Types ====================

export interface RecipeRef {
  id: string;
  title: string;
  servings?: number;
  totalMinutes?: number;
  source?: string;
}

export interface DayMeals {
  breakfast?: RecipeRef;
  lunch?: RecipeRef;
  dinner?: RecipeRef;
}

export interface MealPlanDay {
  date: string;
  meals: DayMeals;
}

export interface MealPlanGrocery {
  missingItems?: Array<{
    name: string;
    qty?: number;
    unit?: string;
    recipes?: string[];
  }>;
}

export interface MealPlanJSON {
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  grocery?: MealPlanGrocery;
}

export type MealPlans = Record<string, MealPlanJSON>;

// ==================== Grocery List Types ====================

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  quantity?: number;
  unit?: string;
  acquired: boolean;
}

// ==================== Achievement Types ====================

export type AchievementCategory =
  | "GETTING_STARTED"
  | "COOKING"
  | "PLANNING"
  | "INVENTORY"
  | "STREAK";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}

export type Achievements = Record<string, Achievement>;

// ==================== Streak Types ====================

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
  totalCount: number;
  lastBrokenStreak: number;
  brokenAt: string | null;
}

export interface Streaks {
  mealPlanStreak: StreakData;
  cookingStreak: StreakData;
}

// ==================== Token Types ====================

export type TransactionType =
  | "achievement"
  | "meal_cooked"
  | "cooking_streak"
  | "planning_streak"
  | "skip_day"
  | "restore_streak"
  | "decision_game";

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  timestamp: string;
  relatedId?: string;
}

export interface TokenState {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  transactions: Transaction[];
}

// ==================== Recipe Types ====================

export interface IngredientJSON {
  name: string;
  canonicalId?: string;
  qty?: number | string;
  unit?: string;
  notes?: string;
}

export interface StepJSON {
  order: number;
  text: string;
}

// ==================== API Request/Response Types ====================

export interface SyncPayload {
  chefIntake?: ChefIntake;
  inventory?: InventoryItem[];
  mealPlans?: MealPlans;
  groceryList?: GroceryItem[];
  achievements?: Achievements;
  streaks?: Streaks;
  tokenState?: TokenState;
}

export interface SyncResponse {
  syncedAt: string;
  version: number;
}

export interface UserBackup {
  profile: {
    chefIntake?: ChefIntake;
    inventory?: InventoryItem[];
    mealPlans?: MealPlans;
    groceryList?: GroceryItem[];
    achievements?: Achievements;
    streaks?: Streaks;
    tokenState?: TokenState;
    lastSyncedAt?: string;
    syncVersion: number;
  };
  recipes: Array<{
    id: string;
    title: string;
    description?: string;
    servings?: number;
    totalMinutes?: number;
    tags?: string[];
    ingredients: IngredientJSON[];
    steps?: StepJSON[];
    source?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

// ==================== Social Feature Types ====================

export interface UserBasic {
  id: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  friendCode?: string;
  bio?: string;
}

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  createdAt: Date;
  updatedAt: Date;
  friend?: UserBasic;
}

export interface RecipePost {
  id: string;
  userId: string;
  recipeId: string;
  text?: string;
  photoUrl?: string;
  rating?: number; // 1-5
  review?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserBasic;
  recipe?: RecipeBasic;
  likeCount?: number;
  commentCount?: number;
  isLikedByCurrentUser?: boolean;
}

export interface RecipeBasic {
  id: string;
  title: string;
  description?: string;
  servings?: number;
  totalMinutes?: number;
  tags?: string[];
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserBasic;
}

export interface FeedActivity {
  id: string;
  userId: string;
  activityType: "post" | "meal_plan" | "recipe_saved" | "friend_added";
  postId?: string;
  recipeId?: string;
  metadata?: {
    friendId?: string;
    friendName?: string;
    recipeTitle?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  user: UserBasic;
  post?: RecipePost;
  recipe?: RecipeBasic;
}
