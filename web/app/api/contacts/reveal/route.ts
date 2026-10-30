import { handleContactsRequest } from '@/lib/contacts/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return handleContactsRequest(request, 'contacts.reveal'); }
export function OPTIONS(request: Request) { return handleContactsRequest(request, 'contacts.reveal'); }
