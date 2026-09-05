import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ErrorPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-20">
      <section className="apple-card w-full p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          We could not finish that request.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          No additional action is needed right now. Check your billing status, then retry from the pricing page.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/pricing">Return to pricing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
