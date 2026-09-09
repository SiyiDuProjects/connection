import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import { PasswordRecovery } from '../password-recovery';
import '../../auth.css';
import '../../marketing.css';

export const metadata: Metadata = {
  title: `Forgot password | ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <PasswordRecovery />;
}
