import { AuthPage, type AuthSearchParams } from '../auth-page';

export default function SignUpPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  return <AuthPage mode="signup" searchParams={searchParams} />;
}
