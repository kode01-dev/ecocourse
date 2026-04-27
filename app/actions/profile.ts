'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  upsertProfile,
  setDietaryPreferences,
  setAllergies,
  setDislikes,
} from '@/lib/db/queries/profiles';
import { dietaryPrefEnum, allergenEnum, severityEnum } from '@/lib/db/schema';

const dietaryValues = dietaryPrefEnum.enumValues;
const allergenValues = allergenEnum.enumValues;
const severityValues = severityEnum.enumValues;

const onboardingSchema = z.object({
  postalCode: z.string().regex(/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, 'Code postal invalide (ex: G1A 1A1)').optional().or(z.literal('')),
  householdSize: z.coerce.number().int().min(1).max(20).default(1),
  weeklyBudget: z.coerce.number().positive().optional().or(z.literal('')),
  shoppingMode: z.enum(['single_store', 'multi_store']).default('multi_store'),
  recipesPerWeek: z.coerce.number().int().min(1).max(14).default(5),
  dietaryPrefs: z.array(z.enum(dietaryValues)).default([]),
  allergies: z.array(z.object({
    allergen: z.enum(allergenValues),
    severity: z.enum(severityValues),
  })).default([]),
  dislikes: z.string().default(''),
});

export type ProfileActionState = { error?: string } | undefined;

export async function saveProfileAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Non authentifié' };

  const raw = {
    postalCode: formData.get('postalCode') as string,
    householdSize: formData.get('householdSize'),
    weeklyBudget: formData.get('weeklyBudget'),
    shoppingMode: formData.get('shoppingMode'),
    recipesPerWeek: formData.get('recipesPerWeek'),
    dietaryPrefs: formData.getAll('dietaryPrefs') as string[],
    allergies: (() => {
      const raw = formData.get('allergiesJson') as string;
      try { return JSON.parse(raw); } catch { return []; }
    })(),
    dislikes: formData.get('dislikes') as string,
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' };
  }

  const { postalCode, householdSize, weeklyBudget, shoppingMode, recipesPerWeek, dietaryPrefs, allergies: allergyList, dislikes } = parsed.data;

  const userId = session.user.id;

  await upsertProfile(userId, {
    postalCode: postalCode || undefined,
    householdSize,
    weeklyBudget: weeklyBudget ? String(weeklyBudget) : null,
    shoppingMode,
    recipesPerWeek,
  });

  await setDietaryPreferences(userId, dietaryPrefs);
  await setAllergies(userId, allergyList);
  await setDislikes(userId, dislikes.split(',').map((s) => s.trim()).filter(Boolean));

  redirect('/home');
}

export async function saveSettingsAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Non authentifié' };

  const raw = {
    postalCode: formData.get('postalCode') as string,
    householdSize: formData.get('householdSize'),
    weeklyBudget: formData.get('weeklyBudget'),
    shoppingMode: formData.get('shoppingMode'),
    recipesPerWeek: formData.get('recipesPerWeek'),
    dietaryPrefs: formData.getAll('dietaryPrefs') as string[],
    allergies: (() => {
      const raw = formData.get('allergiesJson') as string;
      try { return JSON.parse(raw); } catch { return []; }
    })(),
    dislikes: formData.get('dislikes') as string,
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' };
  }

  const { postalCode, householdSize, weeklyBudget, shoppingMode, recipesPerWeek, dietaryPrefs, allergies: allergyList, dislikes } = parsed.data;

  const userId = session.user.id;

  await upsertProfile(userId, {
    postalCode: postalCode || undefined,
    householdSize,
    weeklyBudget: weeklyBudget ? String(weeklyBudget) : null,
    shoppingMode,
    recipesPerWeek,
  });

  await setDietaryPreferences(userId, dietaryPrefs);
  await setAllergies(userId, allergyList);
  await setDislikes(userId, dislikes.split(',').map((s) => s.trim()).filter(Boolean));

  return undefined; // success — caller can show toast
}
