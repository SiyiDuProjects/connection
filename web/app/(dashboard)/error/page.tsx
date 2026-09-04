import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@heroui/styles';

export default function ErrorPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-20">
      <Card className="w-full p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          We could not finish that request.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          No additional action is needed right now. Check your billing status, then retry from the pricing page.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/pricing" className={buttonVariants({ variant: 'primary' })}>Return to pricing</Link>
          <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>Open dashboard</Link>
        </div>
      </Card>
    </main>
  );
}
