'use client';
import { useEffect, useState } from 'react';
import { ComboBox, Description, FieldError, Input, Label, ListBox } from '@heroui/react';
import type { SchoolOption } from '@/lib/schools';

export function SchoolField({ value, onChange, onSelect }: {
  value: string; onChange: (value: string) => void; onSelect: (school: SchoolOption) => void;
}) {
  const [items, setItems] = useState<SchoolOption[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  useEffect(() => {
    const abort = new AbortController();
    setItems([]);
    if (value.trim().length < 2) { setState('idle'); return; }
    setState('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/metadata/schools?q=${encodeURIComponent(value.trim())}`, { signal: abort.signal });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('Search failed');
        if (!abort.signal.aborted) { setItems(data.schools); setState('ready'); }
      } catch { if (!abort.signal.aborted) setState('error'); }
    }, 180);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [value]);
  return <ComboBox fullWidth isRequired allowsCustomValue allowsEmptyCollection inputValue={value}
    items={items} onInputChange={onChange} onSelectionChange={key => {
      const school = items.find(item => item.id === key); if (school) onSelect(school);
    }}>
    <Label>School or affiliation</Label>
    <ComboBox.InputGroup><Input name="school" maxLength={160} placeholder="Search your school or enter an organization" /><ComboBox.Trigger /></ComboBox.InputGroup>
    <ComboBox.Popover><ListBox items={items} renderEmptyState={() => state === 'loading' ? 'Searching schools…' : state === 'error' ? 'Search unavailable. You can still enter a name.' : 'No matching school. Keep your typed name.'}>
      {item => <ListBox.Item id={item.id} textValue={item.label}><Label>{item.label}</Label><Description>{item.country} · {item.domain}</Description><ListBox.ItemIndicator /></ListBox.Item>}
    </ListBox></ComboBox.Popover>
    <Description>{state === 'error' ? 'Search unavailable. Enter your school or organization manually.' : 'Choose a school for a precise match, or keep a custom affiliation.'}</Description><FieldError />
  </ComboBox>;
}
