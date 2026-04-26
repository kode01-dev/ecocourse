'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/auth';
import { createUser } from '@/lib/db/queries/users';

const credsSchema = z.object({
  email: z.string().email('Courriel invalide'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(128),
});

export type ActionState = { error?: string } | undefined;

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' };
  }

  try {
    await createUser(parsed.data.email, parsed.data.password);
  } catch (e) {
    if (e instanceof Error && e.message === 'EMAIL_TAKEN') {
      return { error: 'Ce courriel est déjà utilisé.' };
    }
    console.error('[signup] createUser failed:', e);
    // postgres-js wraps the underlying error in `cause`
    const root = e instanceof Error && e.cause instanceof Error ? e.cause : e;
    const detail = root instanceof Error ? root.message : 'unknown';
    const code = (root as { code?: string })?.code;
    return { error: `Erreur : ${detail}${code ? ` [${code}]` : ''}` };
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect('/onboarding');
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'Identifiants invalides' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return { error: 'Identifiants invalides' };
  }

  redirect('/home');
}

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}
