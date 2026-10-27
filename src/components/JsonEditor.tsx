import { Button, Card, Col, Input, Row, Space, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function toEntries(obj) {
  return Object.entries(obj).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
}

// Derive the editor state from an external value.
function derive(value) {
  if (value === undefined || value === null || value === '') return { text: '{}', entries: [], error: '' };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return { text: JSON.stringify(parsed, null, 2), entries: isObject(parsed) ? toEntries(parsed) : null, error: '' };
  } catch {
    return { text: typeof value === 'string' ? value : JSON.stringify(value), entries: null, error: 'Invalid JSON' };
  }
}

function JsonEditor({ value, onChange, label = 'JSON' }: { value?: any; onChange?: any; label?: string }) {
  const [mode, setMode] = useState('form');
  const [initial] = useState(() => derive(value));
  const [text, setText] = useState(initial.text);
  const [error, setError] = useState(initial.error);
  const [entries, setEntries] = useState(initial.entries || []);
  const [synced, setSynced] = useState(value);
  const [emitted, setEmitted] = useState(undefined);

  // Re-sync only when the value changes from the outside (e.g. form reset). Echoes
  // of our own onChange must not be re-derived: that dropped half-typed entries
  // (empty key) and re-formatted the JSON text under the cursor while typing.
  if (value !== synced) {
    setSynced(value);
    if (value !== emitted) {
      const next = derive(value);
      setText(next.text);
      setError(next.error);
      if (next.entries) setEntries(next.entries);
      else if (!next.error) setEntries([]);
    }
  }

  const emit = (str) => {
    setEmitted(str);
    onChange?.(str);
  };

  const syncToText = (newEntries) => {
    const obj = {};
    for (const e of newEntries) {
      if (!e.key) continue;
      try {
        obj[e.key] = JSON.parse(e.value);
      } catch {
        obj[e.key] = e.value;
      }
    }
    const str = JSON.stringify(obj, null, 2);
    setText(str);
    setError('');
    emit(str);
  };

  const syncToForm = (str) => {
    try {
      const parsed = JSON.parse(str);
      if (isObject(parsed)) setEntries(toEntries(parsed));
      setError('');
      emit(str);
    } catch {
      setError('Invalid JSON');
      emit(str);
    }
  };

  const addEntry = () => {
    const newEntries = [...entries, { key: '', value: '' }];
    setEntries(newEntries);
  };

  const updateEntry = (idx, key, val) => {
    const newEntries = [...entries];
    newEntries[idx] = { ...newEntries[idx], [key]: val };
    setEntries(newEntries);
    syncToText(newEntries);
  };

  const removeEntry = (idx) => {
    const newEntries = entries.filter((_, i) => i !== idx);
    setEntries(newEntries);
    syncToText(newEntries);
  };

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>{label}</Typography.Text>
        <Space size={4}>
          <Button size="small" type={mode === 'form' ? 'primary' : 'default'} onClick={() => setMode('form')}>Form</Button>
          <Button size="small" type={mode === 'text' ? 'primary' : 'default'} onClick={() => setMode('text')}>JSON Text</Button>
        </Space>
      </div>
      
      {mode === 'form' ? (
        <div>
          {entries.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ant-color-text-tertiary)', border: '1px dashed var(--ant-color-border)', borderRadius: 6 }}>
              <Typography.Text type="secondary">No entries</Typography.Text>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {entries.map((entry, idx) => (
                <Row key={idx} gutter={[6, 6]} align="middle">
                  <Col xs={10} sm={8}>
                    <Input
                      size="small"
                      value={entry.key}
                      placeholder="Key"
                      onChange={(e) => updateEntry(idx, 'key', e.target.value)}
                    />
                  </Col>
                  <Col xs={12} sm={14}>
                    <Input
                      size="small"
                      value={entry.value}
                      placeholder="Value"
                      onChange={(e) => updateEntry(idx, 'value', e.target.value)}
                    />
                  </Col>
                  <Col xs={2}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeEntry(idx)} />
                  </Col>
                </Row>
              ))}
            </Space>
          )}
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEntry} style={{ marginTop: 8 }}>
            Add Entry
          </Button>
        </div>
      ) : (
        <div>
          <Input.TextArea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              syncToForm(e.target.value);
            }}
            rows={6}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {error && <Typography.Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{error}</Typography.Text>}
        </div>
      )}
    </Card>
  );
}

export default JsonEditor;
