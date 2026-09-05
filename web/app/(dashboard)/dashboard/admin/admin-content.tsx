'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Alert, Button, Card, Form, Input, Label, TextArea, TextField, FieldError, Spinner } from '@heroui/react';
import { DataGrid, type DataGridColumn } from '@heroui-pro/react';
import { KPI } from '@heroui-pro/react/kpi';
import { translate as t } from '@/lib/i18n';

export type AdminOverview = {
  error?: string;
  summary: {
    totalUsers: number;
    totalApiCalls: number;
    totalCreditsGranted: number;
    totalCreditsSpent: number;
    totalInternalCostUsd: number;
    internalCost30dUsd: number;
  };
  internalCosts: {
    source: string;
    provider: string;
    model: string;
    billing: string;
    calls: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  users: {
    id: number;
    email: string;
    createdAt: string;
    planName: string | null;
    subscriptionStatus: string | null;
    creditBalance: number;
    lastUsedAt: string | null;
  }[];
  recentUsage: {
    id: number;
    email: string;
    action: string;
    credits: number;
    status: string;
    createdAt: string;
  }[];
};


export default function AdminPage() {
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<{message:string;failed:boolean}>();
  const [pending,setPending]=useState(false);
  const {data,error,mutate,isLoading}=useSWR<AdminOverview>('/api/admin/overview'+(query?'?search='+encodeURIComponent(query):''),async (url:string)=>{
    const res=await fetch(url); const payload=await res.json();
    if(!res.ok||payload.error)throw new Error(payload.error||'Could not load administration.');
    return payload;
  });
  async function grantCredits(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;
    setStatus(undefined);setPending(true);
    try {
      const res=await fetch('/api/admin/credits/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      const payload=await res.json();
      if(!res.ok)throw new Error(payload.error||t('admin.grantError'));
      setStatus({message:t('admin.grantSuccess',{email:payload.user.email,balance:payload.credits.balance}),failed:false});
      form.reset();await mutate();
    }catch(error){setStatus({message:error instanceof Error?error.message:t('admin.grantError'),failed:true});}
    finally{setPending(false);}
  }
  if(error)return <div className="dashboard-page-content"><Alert status="danger"><Alert.Indicator/><Alert.Content><Alert.Description>{error.message}</Alert.Description><Button className="mt-2" variant="secondary" onPress={()=>void mutate()}>Try again</Button></Alert.Content></Alert></div>;
  return <AdminPanel data={data} loading={isLoading} search={search} onSearchChange={setSearch} onSearch={event=>{event.preventDefault();setQuery(search.trim());}} onGrant={grantCredits} status={status} pending={pending}/>;
}

const costs:DataGridColumn<AdminOverview['internalCosts'][number]>[]=[
 {id:'source',header:'Source',accessorKey:'source',isRowHeader:true,minWidth:120},
 {id:'provider',header:'Provider / model',cell:row=>row.provider||row.model||'—',minWidth:150},
 {id:'billing',header:'Billing',accessorKey:'billing',minWidth:110},
 {id:'calls',header:'Calls',accessorKey:'calls',align:'end'},
 {id:'tokens',header:'Tokens in / out',cell:row=>row.inputTokens+' / '+row.outputTokens,cellClassName:'tabular-nums',minWidth:140},
 {id:'cost',header:'Cost',cell:row=>formatUsd(row.costUsd),align:'end',cellClassName:'tabular-nums'}
];
const users:DataGridColumn<AdminOverview['users'][number]>[]=[
 {id:'email',header:t('admin.email'),accessorKey:'email',isRowHeader:true,minWidth:200},
 {id:'plan',header:t('admin.plan'),cell:row=><div>{row.planName||t('admin.free')}<p className="text-xs text-muted">{row.subscriptionStatus||t('admin.inactive')}</p></div>,minWidth:130},
 {id:'credits',header:t('admin.credits'),accessorKey:'creditBalance',align:'end',cellClassName:'tabular-nums'},
 {id:'lastUsedAt',header:t('admin.lastUsed'),cell:row=>formatDate(row.lastUsedAt),minWidth:160},
 {id:'createdAt',header:t('admin.created'),cell:row=>formatDate(row.createdAt),minWidth:160}
];
const usage:DataGridColumn<AdminOverview['recentUsage'][number]>[]=[
 {id:'email',header:t('admin.user'),accessorKey:'email',isRowHeader:true,minWidth:200},
 {id:'action',header:t('admin.action'),accessorKey:'action',minWidth:150},
 {id:'credits',header:t('admin.credits'),accessorKey:'credits',align:'end',cellClassName:'tabular-nums'},
 {id:'status',header:t('admin.status'),accessorKey:'status',minWidth:100},
 {id:'createdAt',header:t('admin.date'),cell:row=>formatDate(row.createdAt),minWidth:160}
];

export function AdminPanel({data,loading,search='',onSearchChange,onSearch,onGrant,status,pending=false,preview=false}:{
 data?:AdminOverview;loading?:boolean;search?:string;onSearchChange?:(value:string)=>void;
 onSearch?:(event:FormEvent<HTMLFormElement>)=>void;onGrant?:(event:FormEvent<HTMLFormElement>)=>void;
 status?:{message:string;failed:boolean};pending?:boolean;preview?:boolean;
}){
 if(loading)return <div className="flex justify-center p-12"><Spinner aria-label="Loading administration"/></div>;
 const summary=data?.summary;
 return <div className="dashboard-page-content flex flex-col gap-6">
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
     <Metric label={t('admin.users')} value={summary?.totalUsers}/>
     <Metric label={t('admin.apiCalls')} value={summary?.totalApiCalls}/>
     <Metric label={t('admin.creditsGranted')} value={summary?.totalCreditsGranted}/>
     <Metric label={t('admin.creditsSpent')} value={summary?.totalCreditsSpent}/>
     <Metric label="Provider cost · 30d" value={summary?.internalCost30dUsd} currency/>
     <Metric label="Provider cost · all time" value={summary?.totalInternalCostUsd} currency/>
   </div>
   <Card><Card.Header><Card.Title>Internal provider cost · last 30 days</Card.Title></Card.Header><Card.Content>
     <DataGrid aria-label="Internal provider costs" columns={costs} contentClassName="min-w-[760px]" data={data?.internalCosts||[]} getRowId={row=>[row.source,row.provider,row.model,row.billing].join('-')} renderEmptyState={()=>'No internal cost records yet.'}/>
   </Card.Content></Card>
   <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
     <Card className="min-w-0"><Card.Header><Card.Title>{t('admin.users')}</Card.Title></Card.Header><Card.Content className="gap-4">
       <Form className="flex flex-row gap-2" onSubmit={preview?event=>event.preventDefault():onSearch}>
         <TextField aria-label={t('admin.searchEmail')} value={search} onChange={onSearchChange} className="min-w-0 flex-1"><Input placeholder={t('admin.searchEmail')}/></TextField>
         <Button type="submit" variant="secondary" isDisabled={preview}>{t('admin.search')}</Button>
       </Form>
       <DataGrid aria-label="Users" columns={users} contentClassName="min-w-[760px]" data={data?.users||[]} getRowId={row=>String(row.id)} renderEmptyState={()=>t('admin.noUsers')}/>
     </Card.Content></Card>
     <Card><Card.Header><Card.Title>{t('admin.grantCredits')}</Card.Title></Card.Header><Card.Content>
       <Form className="flex flex-col gap-4" onSubmit={preview?event=>event.preventDefault():onGrant}>
         <TextField name="email" type="email" isRequired isDisabled={pending} fullWidth><Label>{t('admin.userEmail')}</Label><Input autoComplete="off"/><FieldError/></TextField>
         <TextField name="amount" type="number" isRequired isDisabled={pending} fullWidth><Label>{t('admin.credits')}</Label><Input min={1} step={1}/><FieldError/></TextField>
         <TextField name="note" isDisabled={pending} fullWidth><Label>{t('admin.note')}</Label><TextArea rows={3} placeholder={t('admin.notePlaceholder')}/><FieldError/></TextField>
         <Button type="submit" isPending={pending} isDisabled={preview||pending}>{t('admin.grantCredits')}</Button>
         {status&&<Alert status={status.failed?'danger':'success'}><Alert.Indicator/><Alert.Content><Alert.Description>{status.message}</Alert.Description></Alert.Content></Alert>}
       </Form>
     </Card.Content></Card>
   </div>
   <Card><Card.Header><Card.Title>{t('admin.recentUsage')}</Card.Title></Card.Header><Card.Content>
     <DataGrid aria-label="Recent usage" columns={usage} contentClassName="min-w-[740px]" data={data?.recentUsage||[]} getRowId={row=>String(row.id)} renderEmptyState={()=>'No recent usage.'}/>
   </Card.Content></Card>
 </div>;
}
function Metric({label,value,currency=false}:{label:string;value?:number;currency?:boolean}){
 return <KPI><KPI.Header><KPI.Title>{label}</KPI.Title></KPI.Header><KPI.Content>{value===undefined?<span className="text-muted">—</span>:<KPI.Value value={value} style={currency?'currency':'decimal'} currency={currency?'USD':undefined} maximumFractionDigits={currency?4:0}/>}</KPI.Content></KPI>;
}
function formatUsd(value:number){return Number.isFinite(value)?'$'+value.toFixed(4):'—';}
function formatDate(value:string|null){return value?new Date(value).toLocaleString('en-US'):'Never';}
