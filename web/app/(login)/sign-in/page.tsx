import { AuthPage, type AuthSearchParams } from '../auth-page';

export default function SignInPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  return <AuthPage mode="signin" searchParams={searchParams} />;
}
