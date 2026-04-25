import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  pgEnum,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const shoppingModeEnum = pgEnum('shopping_mode', ['single_store', 'multi_store']);
export const dietaryPrefEnum = pgEnum('dietary_pref', [
  'vegetarian',
  'vegan',
  'pescatarian',
  'meat_lover',
  'flexitarian',
  'keto',
  'paleo',
]);
export const allergenEnum = pgEnum('allergen', [
  'gluten',
  'lactose',
  'nuts',
  'peanuts',
  'shellfish',
  'eggs',
  'soy',
  'fish',
  'sesame',
  'sulfites',
]);
export const severityEnum = pgEnum('severity', ['intolerance', 'allergy']);
export const dealSourceEnum = pgEnum('deal_source', ['flipp', 'iga', 'metro', 'maxi', 'superc']);
export const recipeSourceEnum = pgEnum('recipe_source', [
  'ricardo',
  'trois_fois_par_jour',
  'claude_generated',
]);

// ============ Auth ============
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============ Profile ============
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  postalCode: text('postal_code'),
  householdSize: integer('household_size').notNull().default(1),
  weeklyBudget: numeric('weekly_budget', { precision: 10, scale: 2 }),
  shoppingMode: shoppingModeEnum('shopping_mode').notNull().default('multi_store'),
  preferredStoreId: uuid('preferred_store_id').references(() => stores.id, { onDelete: 'set null' }),
  recipesPerWeek: integer('recipes_per_week').notNull().default(5),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dietaryPreferences = pgTable(
  'dietary_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    preferenceType: dietaryPrefEnum('preference_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.preferenceType] })]
);

export const allergies = pgTable(
  'allergies',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    allergen: allergenEnum('allergen').notNull(),
    severity: severityEnum('severity').notNull().default('allergy'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.allergen] })]
);

export const dislikes = pgTable(
  'dislikes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredient: text('ingredient').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ingredient] })]
);

export const pantry = pgTable(
  'pantry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredient: text('ingredient').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }),
    unit: text('unit'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('pantry_user_idx').on(t.userId)]
);

// ============ Catalog ============
export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  flippMerchantId: text('flipp_merchant_id'),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameNormalized: text('name_normalized').notNull(),
    nameRaw: text('name_raw').notNull(),
    category: text('category'),
    unit: text('unit'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('products_normalized_idx').on(t.nameNormalized),
    index('products_category_idx').on(t.category),
  ]
);

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    regularPrice: numeric('regular_price', { precision: 10, scale: 2 }),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to').notNull(),
    source: dealSourceEnum('source').notNull(),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
    rawData: jsonb('raw_data'),
  },
  (t) => [
    index('deals_product_idx').on(t.productId),
    index('deals_store_idx').on(t.storeId),
    index('deals_valid_to_idx').on(t.validTo),
  ]
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ph_product_store_idx').on(t.productId, t.storeId)]
);

// ============ Recipes ============
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: recipeSourceEnum('source').notNull(),
    sourceUrl: text('source_url'),
    title: text('title').notNull(),
    servings: integer('servings').notNull().default(4),
    prepTimeMin: integer('prep_time_min'),
    cookTimeMin: integer('cook_time_min'),
    instructions: text('instructions').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('recipes_source_url_idx').on(t.sourceUrl),
    index('recipes_tags_idx').using('gin', t.tags),
  ]
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientNormalized: text('ingredient_normalized').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }),
    unit: text('unit'),
    optional: boolean('optional').notNull().default(false),
  },
  (t) => [
    index('ri_recipe_idx').on(t.recipeId),
    index('ri_ingredient_idx').on(t.ingredientNormalized),
  ]
);

// ============ Shopping ============
export const shoppingLists = pgTable(
  'shopping_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    totalEstimatedCost: numeric('total_estimated_cost', { precision: 10, scale: 2 }),
    totalSavings: numeric('total_savings', { precision: 10, scale: 2 }),
    mode: shoppingModeEnum('mode').notNull(),
  },
  (t) => [index('shopping_lists_user_idx').on(t.userId)]
);

export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
    dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
    ingredientLabel: text('ingredient_label').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }),
    unit: text('unit'),
    recipeIds: uuid('recipe_ids').array().notNull().default(sql`'{}'::uuid[]`),
    checked: boolean('checked').notNull().default(false),
  },
  (t) => [index('sli_list_idx').on(t.listId)]
);

// ============ Relations ============
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  dietaryPreferences: many(dietaryPreferences),
  allergies: many(allergies),
  dislikes: many(dislikes),
  pantry: many(pantry),
  shoppingLists: many(shoppingLists),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  preferredStore: one(stores, { fields: [profiles.preferredStoreId], references: [stores.id] }),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  user: one(users, { fields: [shoppingLists.userId], references: [users.id] }),
  items: many(shoppingListItems),
}));

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, { fields: [shoppingListItems.listId], references: [shoppingLists.id] }),
  product: one(products, { fields: [shoppingListItems.productId], references: [products.id] }),
  store: one(stores, { fields: [shoppingListItems.storeId], references: [stores.id] }),
  deal: one(deals, { fields: [shoppingListItems.dealId], references: [deals.id] }),
}));
