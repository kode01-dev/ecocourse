CREATE TYPE "public"."allergen" AS ENUM('gluten', 'lactose', 'nuts', 'peanuts', 'shellfish', 'eggs', 'soy', 'fish', 'sesame', 'sulfites');--> statement-breakpoint
CREATE TYPE "public"."deal_source" AS ENUM('flipp', 'iga', 'metro', 'maxi', 'superc');--> statement-breakpoint
CREATE TYPE "public"."dietary_pref" AS ENUM('vegetarian', 'vegan', 'pescatarian', 'meat_lover', 'flexitarian', 'keto', 'paleo');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('ricardo', 'trois_fois_par_jour', 'claude_generated');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('intolerance', 'allergy');--> statement-breakpoint
CREATE TYPE "public"."shopping_mode" AS ENUM('single_store', 'multi_store');--> statement-breakpoint
CREATE TABLE "allergies" (
	"user_id" uuid NOT NULL,
	"allergen" "allergen" NOT NULL,
	"severity" "severity" DEFAULT 'allergy' NOT NULL,
	CONSTRAINT "allergies_user_id_allergen_pk" PRIMARY KEY("user_id","allergen")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"regular_price" numeric(10, 2),
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"source" "deal_source" NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "dietary_preferences" (
	"user_id" uuid NOT NULL,
	"preference_type" "dietary_pref" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dietary_preferences_user_id_preference_type_pk" PRIMARY KEY("user_id","preference_type")
);
--> statement-breakpoint
CREATE TABLE "dislikes" (
	"user_id" uuid NOT NULL,
	"ingredient" text NOT NULL,
	CONSTRAINT "dislikes_user_id_ingredient_pk" PRIMARY KEY("user_id","ingredient")
);
--> statement-breakpoint
CREATE TABLE "pantry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingredient" text NOT NULL,
	"quantity" numeric(10, 2),
	"unit" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_normalized" text NOT NULL,
	"name_raw" text NOT NULL,
	"category" text,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"postal_code" text,
	"household_size" integer DEFAULT 1 NOT NULL,
	"weekly_budget" numeric(10, 2),
	"shopping_mode" "shopping_mode" DEFAULT 'multi_store' NOT NULL,
	"preferred_store_id" uuid,
	"recipes_per_week" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_normalized" text NOT NULL,
	"quantity" numeric(10, 2),
	"unit" text,
	"optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "recipe_source" NOT NULL,
	"source_url" text,
	"title" text NOT NULL,
	"servings" integer DEFAULT 4 NOT NULL,
	"prep_time_min" integer,
	"cook_time_min" integer,
	"instructions" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"product_id" uuid,
	"store_id" uuid,
	"deal_id" uuid,
	"ingredient_label" text NOT NULL,
	"quantity" numeric(10, 2),
	"unit" text,
	"recipe_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"checked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_estimated_cost" numeric(10, 2),
	"total_savings" numeric(10, 2),
	"mode" "shopping_mode" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"flipp_merchant_id" text,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dietary_preferences" ADD CONSTRAINT "dietary_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dislikes" ADD CONSTRAINT "dislikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry" ADD CONSTRAINT "pantry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_preferred_store_id_stores_id_fk" FOREIGN KEY ("preferred_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deals_product_idx" ON "deals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "deals_store_idx" ON "deals" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "deals_valid_to_idx" ON "deals" USING btree ("valid_to");--> statement-breakpoint
CREATE INDEX "pantry_user_idx" ON "pantry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ph_product_store_idx" ON "price_history" USING btree ("product_id","store_id");--> statement-breakpoint
CREATE INDEX "products_normalized_idx" ON "products" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ri_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "ri_ingredient_idx" ON "recipe_ingredients" USING btree ("ingredient_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_source_url_idx" ON "recipes" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "recipes_tags_idx" ON "recipes" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "sli_list_idx" ON "shopping_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_user_idx" ON "shopping_lists" USING btree ("user_id");