import type { Metadata } from 'next';
import SocialAdmin from '@/components/admin/SocialAdmin';

export const metadata: Metadata = {
  title: 'Admin | bKash Social Campaign',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <SocialAdmin />;
}
