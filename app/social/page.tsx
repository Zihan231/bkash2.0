import type { Metadata } from 'next';
import SocialSubmissionForm from '@/components/social/SocialSubmissionForm';

export const metadata: Metadata = {
  title: 'Social Campaign | bKash',
  description: 'Submit your details and campaign screenshot.',
};

export default function SocialPage() {
  return <SocialSubmissionForm />;
}
