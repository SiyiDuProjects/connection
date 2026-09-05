'use client';

import { Alert, Button, Description, Dropdown, FieldError, Form, Input, InputOTP, Label, ListBox, Modal, Select, TextField } from '@heroui/react';
import { ThemeSwitch } from '@/components/reachard/design';
import { AdminPanel, type AdminOverview } from '../(dashboard)/dashboard/admin/admin-content';

const sample:AdminOverview={
  summary:{totalUsers:1,totalApiCalls:3,totalCreditsGranted:10,totalCreditsSpent:1,totalInternalCostUsd:0.035,internalCost30dUsd:0.035},
  internalCosts:[{source:'Fixture',provider:'Sample provider',model:'',billing:'usage',calls:3,costUsd:0.035,inputTokens:120,outputTokens:30}],
  users:[{id:1,email:'sample@example.com',createdAt:'2026-09-01T12:00:00Z',planName:'Base',subscriptionStatus:'active',creditBalance:9,lastUsedAt:null}],
  recentUsage:[{id:1,email:'sample@example.com',action:'contacts.reveal',credits:1,status:'success',createdAt:'2026-09-01T12:00:00Z'}]
};

// Local fixtures only: no account requests, server actions, sends or mutations.
export function ComponentChecks(){
 return <main className="mx-auto max-w-7xl space-y-6 p-5">
   <header className="flex items-center justify-between"><h1 className="text-xl font-semibold">Local component checks · sample data</h1><ThemeSwitch/></header>
   <div className="grid gap-6 md:grid-cols-2">
     <Form className="flex flex-col gap-4" onSubmit={event=>event.preventDefault()}>
       <TextField name="email" type="email" isRequired fullWidth><Label>Email address</Label><Input placeholder="you@example.com"/><FieldError/></TextField>
       <TextField isInvalid fullWidth defaultValue="Sample"><Label>Invalid field</Label><Input/><FieldError>Check this value.</FieldError></TextField>
       <TextField isDisabled fullWidth defaultValue="Sample"><Label>Disabled field</Label><Input/></TextField>
       <InputOTP aria-label="Verification code" maxLength={6}><InputOTP.Group>{[0,1,2,3,4,5].map(index=><InputOTP.Slot key={index} index={index}/>)}</InputOTP.Group></InputOTP>
       <Button type="submit">Check required field</Button>
     </Form>
     <div className="flex flex-col gap-4">
       <Select fullWidth defaultValue="warm"><Label>Example tone</Label><Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger><Select.Popover><ListBox>
         <ListBox.Item id="warm" textValue="Warm"><Label>Warm</Label><Description>Friendly and personal.</Description><ListBox.ItemIndicator/></ListBox.Item>
         <ListBox.Item id="concise" textValue="Concise"><Label>Concise</Label><Description>Short and direct.</Description><ListBox.ItemIndicator/></ListBox.Item>
       </ListBox></Select.Popover></Select>
       <Dropdown><Button variant="ghost">Example menu</Button><Dropdown.Popover><Dropdown.Menu aria-label="Example menu"><Dropdown.Item id="settings" textValue="Settings"><Label>Settings</Label></Dropdown.Item><Dropdown.Item id="delete" textValue="Delete" variant="danger"><Label>Delete</Label></Dropdown.Item></Dropdown.Menu></Dropdown.Popover></Dropdown>
       <Modal><Button variant="secondary">Example dialog</Button><Modal.Backdrop><Modal.Container size="sm"><Modal.Dialog><Modal.CloseTrigger/><Modal.Header><Modal.Heading>Sample dialog</Modal.Heading></Modal.Header><Modal.Body><Description>This dialog inherits the root theme.</Description></Modal.Body><Modal.Footer><Button slot="close">Close dialog</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
       <Alert status="success"><Alert.Indicator/><Alert.Content><Alert.Description>Sample success state.</Alert.Description></Alert.Content></Alert>
       <Alert status="danger"><Alert.Indicator/><Alert.Content><Alert.Description>Sample error state.</Alert.Description></Alert.Content></Alert>
     </div>
   </div>
   <AdminPanel data={sample} preview/>
 </main>;
}
