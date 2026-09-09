import { BRAND_NAME } from '@/lib/brand';
import type { Metadata } from 'next';
import { GettingStarted } from './getting-started';

export const metadata: Metadata = {
  title: `Get started with the ${BRAND_NAME} extension`,
  description: `Install and pin ${BRAND_NAME}, open a job page, and find your first person to contact.`
};

export default function GettingStartedPage() { return <GettingStarted />; }
