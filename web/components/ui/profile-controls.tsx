'use client';

import { Button, Description, Input, Label, ListBox, Modal, Radio, RadioGroup, TextArea, TextField } from '@heroui/react';
import type { ReactNode } from 'react';

type FieldProps = { label: string; value: string; onChange: (value: string) => void };

export function ProfileTextField({ label, value, onChange }: FieldProps) {
  return <TextField value={value} onChange={onChange}><Label>{label}</Label><Input /></TextField>;
}

export function ProfileTextArea({ label, value, onChange }: FieldProps) {
  return <TextField value={value} onChange={onChange}><Label>{label}</Label><TextArea rows={5} /></TextField>;
}

export function PreferenceOptions({ label, value, options, onChange, isDisabled }: FieldProps & { options: [string, string][]; isDisabled?: boolean }) {
  return <RadioGroup value={value} onChange={onChange} isDisabled={isDisabled} orientation="horizontal">
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-4">{options.map(([key, text]) => <Radio key={key} value={key}><Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control><Label>{text}</Label></Radio.Content></Radio>)}</div>
  </RadioGroup>;
}

export function ProfileModal({ title, children, onClose, closeLabel }: { title: string; children: ReactNode; onClose: () => void; closeLabel: string }) {
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}>
    <Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog>
      <Modal.CloseTrigger aria-label={closeLabel} />
      <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
      <Modal.Body>{children}</Modal.Body>
    </Modal.Dialog></Modal.Container></Modal.Backdrop>
  </Modal>;
}

export function ProfileActions({ saving, primaryLabel, cancelLabel, onPrimary, onCancel }: { saving: boolean; primaryLabel: string; cancelLabel: string; onPrimary: () => void; onCancel: () => void }) {
  return <div className="mt-8 flex flex-col gap-3"><Button fullWidth isDisabled={saving} isPending={saving} onPress={onPrimary}>{primaryLabel}</Button><Button fullWidth variant="tertiary" onPress={onCancel}>{cancelLabel}</Button></div>;
}

export function ResolvedOptions<T extends { type: string; id: string; label: string; subtitle?: string }>({ items, onSelect, label }: { items: T[]; onSelect: (item: T) => void; label: string }) {
  if (!items.length) return null;
  return <ListBox aria-label={label} className="mt-2" onAction={(key) => { const item = items.find((entry) => `${entry.type}-${entry.id}` === key); if (item) onSelect(item); }}>
    {items.map((item) => <ListBox.Item id={`${item.type}-${item.id}`} key={`${item.type}-${item.id}`} textValue={item.label}><Label>{item.label}</Label>{item.subtitle && <Description>{item.subtitle}</Description>}</ListBox.Item>)}
  </ListBox>;
}
