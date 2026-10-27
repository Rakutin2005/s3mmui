import { InputNumber, Select, Space } from 'antd';
import { useState } from 'react';

const units = ['B', 'K', 'M', 'G', 'T'].map((value: any) => ({ value, label: value }));

function parse(value) {
  const match = String(value ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return { number: '', unit: 'B' };
  return { number: match[1], unit: match[2] || 'B' };
}

export default function SizeInput({ value, onChange }: { value?: any; onChange?: any }) {
  const initial = parse(value);
  const [number, setNumber] = useState(initial.number);
  const [unit, setUnit] = useState(initial.unit);

  const [synced, setSynced] = useState(value);
  // follow external value changes (form reset / setFieldsValue)
  if (value !== synced) {
    const next = parse(value);
    setSynced(value);
    setNumber(next.number);
    setUnit(next.unit);
  }

  const emit = (nextNumber, nextUnit) => {
    if (nextNumber === '' || nextNumber === null || nextNumber === undefined) {
      onChange?.('');
      return;
    }
    onChange?.(`${nextNumber}${nextUnit}`);
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber value={number === "" ? undefined : Number(number)} min={0} style={{ width: '100%' }} onChange={(v) => { const s = v == null ? "" : String(v); setNumber(s); emit(s, unit); }} />
      <Select value={unit} onChange={(v) => { setUnit(v); emit(number, v); }} options={units} style={{ width: 90 }} />
    </Space.Compact>
  );
}
