'use client';
import { BRAND_NAME } from '@/lib/brand';

import { useMemo, useState } from 'react';
import { ExtensionInstallLink } from '@/components/extension-install-link';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowsRotateLeft } from '@gravity-ui/icons';
import { Alert, Button, Chip, SearchField, Spinner, Tabs, Tooltip } from '@heroui/react';
import { DataGrid, EmptyState, type DataGridColumn, type DataGridSortDescriptor } from '@heroui-pro/react';
import { actionNames, type DashboardAccount, type DashboardUsage } from '@/lib/dashboard';

export async function fetchDashboardAccount(url: string): Promise<DashboardAccount> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not load your account.');
  return payload;
}

export function DashboardOverview({ preview = false }: { preview?: boolean }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardAccount>(preview ? null : '/api/account', fetchDashboardAccount);
  return <DashboardOverviewContent account={data} preview={preview}
    error={error?.message} loading={isLoading} refreshing={isValidating} onRefresh={() => void mutate()} />;
}

export function DashboardOverviewContent({ account, preview, error, loading, refreshing, onRefresh }: {
  account?: DashboardAccount; preview?: boolean; error?: string;
  loading?: boolean; refreshing?: boolean; onRefresh?: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DataGridSortDescriptor>({ column: 'createdAt', direction: 'descending' });
  const usage = useMemo(() => account?.usage || [], [account?.usage]);
  const rows = useMemo(() => usage.filter(row => (filter === 'all' || row.action === filter) &&
    [row.request?.companyName, row.request?.jobTitle, actionNames[row.action] || row.action].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const read = (row: DashboardUsage) => sort.column === 'company' ? row.request?.companyName || '' : sort.column === 'action' ? actionNames[row.action] || row.action : sort.column === 'status' ? row.status : row.createdAt;
      return read(a).localeCompare(read(b)) * (sort.direction === 'descending' ? -1 : 1);
    }), [usage, filter, search, sort]);
  const columns = useMemo<DataGridColumn<DashboardUsage>[]>(() => [
    { id: 'action', header: 'Activity', isRowHeader: true, allowsSorting: true, minWidth: 150, cell: row => <span className="font-medium">{actionNames[row.action] || row.action}</span> },
    { id: 'company', header: 'Company / role', allowsSorting: true, minWidth: 220, cell: row => <div><p className="font-medium">{row.request?.companyName || '—'}</p><p className="mt-1 text-xs text-muted">{row.request?.jobTitle || '—'}</p></div> },
    { id: 'status', header: 'Status', allowsSorting: true, minWidth: 110, cell: row => <Chip size="sm" variant="soft" color={row.status === 'success' ? 'success' : row.status === 'error' || row.status === 'failed' ? 'danger' : 'default'}>{row.status === 'success' ? 'Completed' : row.status}</Chip> },
    { id: 'createdAt', header: 'Date', allowsSorting: true, minWidth: 160, cell: row => Number.isFinite(Date.parse(row.createdAt)) ? new Date(row.createdAt).toLocaleString() : '—' }
  ], []);
  return <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pb-10 pt-4">
    {preview ? <p className="text-xs text-muted">{BRAND_NAME} preview · <Link href="/sign-in" className="text-accent underline">Sign in</Link> to load your account.</p> : null}
    {error ? <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}
    {account?.trial ? <Alert><Alert.Indicator /><Alert.Content><Alert.Title>{account.trial.remaining > 0 ? `${account.trial.remaining} of 3 free email unlocks remaining` : 'Your free email unlocks have been used'}</Alert.Title><Alert.Description>No card required. You will only be charged if you choose a paid plan. <Link href="/pricing" className="underline">View plans</Link></Alert.Description></Alert.Content></Alert> : null}
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold">Recent activity</h2><p className="mt-1 text-sm text-muted">Your latest 10 searches, email reveals and drafts.</p></div>
      <Tooltip><Button isIconOnly size="sm" variant="tertiary" aria-label="Refresh activity" isDisabled={preview || refreshing} onPress={onRefresh}><ArrowsRotateLeft className="size-4" /></Button><Tooltip.Content>Refresh activity</Tooltip.Content></Tooltip>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs selectedKey={filter} onSelectionChange={key => setFilter(String(key))}><Tabs.ListContainer><Tabs.List aria-label="Activity filter">
        <Tabs.Tab id="all">All<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="contacts.search">Searches<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="contacts.reveal">Reveals<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="email.draft">Drafts<Tabs.Indicator /></Tabs.Tab>
      </Tabs.List></Tabs.ListContainer></Tabs>
      <SearchField aria-label="Search activity" className="w-full sm:w-60" value={search} onChange={setSearch}><SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder="Company, role or activity…" /><SearchField.ClearButton /></SearchField.Group></SearchField>
    </div>
    {loading ? <div className="flex justify-center py-10"><Spinner aria-label="Loading activity" /></div> : rows.length ? <DataGrid aria-label="Outreach history" columns={columns} contentClassName="min-w-[640px]" data={rows} getRowId={row => String(row.id)} sortDescriptor={sort} onSortChange={setSort} /> : !error ? <EmptyState><EmptyState.Header><EmptyState.Title>{search || filter !== 'all' ? 'No matching activity' : 'Prepare your first message'}</EmptyState.Title><EmptyState.Description>{preview ? 'Sign in to see your own activity.' : search || filter !== 'all' ? 'Try another search or switch to All.' : `Open a job or company page in desktop Chrome, then open ${BRAND_NAME} to find people and prepare a draft.`}</EmptyState.Description></EmptyState.Header><EmptyState.Content>{search || filter !== 'all' ? <Button variant="secondary" onPress={() => { setSearch(''); setFilter('all'); }}>Clear filters</Button> : <><ExtensionInstallLink size="sm" /><Link href="/getting-started" className="text-sm text-accent underline">How to prepare your first draft</Link></>}</EmptyState.Content></EmptyState> : null}
  </div>;
}
