import { handleContactsRequest } from '@/lib/contacts/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleContactsRequest(request, 'health'); }
export function OPTIONS(request: Request) { return handleContactsRequest(request, 'health'); }
