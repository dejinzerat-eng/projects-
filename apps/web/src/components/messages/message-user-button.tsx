import { getMe } from '@/lib/api';
import { MessageUserDialog } from './message-user-dialog';

/** Tlačítko „Napsat zprávu“ na veřejném profilu. Na vlastním profilu se nezobrazí. */
export async function MessageUserButton({ userId, name }: { userId: string; name: string }) {
  const me = await getMe();
  if (me?.id === userId) return null;
  return <MessageUserDialog userId={userId} name={name} loggedIn={!!me} />;
}
