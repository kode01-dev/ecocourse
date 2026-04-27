import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  profiles,
  dietaryPreferences,
  allergies,
  dislikes,
  type dietaryPrefEnum,
  type allergenEnum,
  type severityEnum,
} from '@/lib/db/schema';

type DietaryPref = (typeof dietaryPrefEnum.enumValues)[number];
type Allergen = (typeof allergenEnum.enumValues)[number];
type Severity = (typeof severityEnum.enumValues)[number];

export async function getProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile ?? null;
}

export async function upsertProfile(
  userId: string,
  data: {
    postalCode?: string;
    householdSize?: number;
    weeklyBudget?: string | null;
    shoppingMode?: 'single_store' | 'multi_store';
    recipesPerWeek?: number;
  }
) {
  await db
    .insert(profiles)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...data, updatedAt: new Date() },
    });
}

export async function getDietaryPreferences(userId: string) {
  return db.select().from(dietaryPreferences).where(eq(dietaryPreferences.userId, userId));
}

export async function setDietaryPreferences(userId: string, prefs: DietaryPref[]) {
  await db.delete(dietaryPreferences).where(eq(dietaryPreferences.userId, userId));
  if (prefs.length > 0) {
    await db.insert(dietaryPreferences).values(prefs.map((p) => ({ userId, preferenceType: p })));
  }
}

export async function getAllergies(userId: string) {
  return db.select().from(allergies).where(eq(allergies.userId, userId));
}

export async function setAllergies(userId: string, items: { allergen: Allergen; severity: Severity }[]) {
  await db.delete(allergies).where(eq(allergies.userId, userId));
  if (items.length > 0) {
    await db.insert(allergies).values(items.map((a) => ({ userId, ...a })));
  }
}

export async function getDislikes(userId: string) {
  return db.select().from(dislikes).where(eq(dislikes.userId, userId));
}

export async function setDislikes(userId: string, ingredients: string[]) {
  await db.delete(dislikes).where(eq(dislikes.userId, userId));
  const unique = [...new Set(ingredients.map((i) => i.trim().toLowerCase()).filter(Boolean))];
  if (unique.length > 0) {
    await db.insert(dislikes).values(unique.map((ingredient) => ({ userId, ingredient })));
  }
}

export async function getFullProfile(userId: string) {
  const [profile, prefs, userAllergies, userDislikes] = await Promise.all([
    getProfile(userId),
    getDietaryPreferences(userId),
    getAllergies(userId),
    getDislikes(userId),
  ]);
  return { profile, prefs, allergies: userAllergies, dislikes: userDislikes };
}
