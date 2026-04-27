'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { toggleListItem } from '@/lib/db/queries/shopping';

export async function toggleItemAction(itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await toggleListItem(itemId, session.user.id);
  revalidatePath('/list/[id]', 'page');
}
