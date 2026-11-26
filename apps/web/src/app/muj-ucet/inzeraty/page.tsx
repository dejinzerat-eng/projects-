import { MyListings } from '@/components/my-listings';
import { authApi } from '@/lib/api';
export const metadata = { title: 'Moje inzeráty', robots: { index: false } };
export default async function Page() {
  return <MyListings items={await authApi('/me/listings', '/muj-ucet/inzeraty')} />;
}
