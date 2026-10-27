import { Button, Card, Col, Input, InputNumber, Row, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import SizeInput from './SizeInput.jsx';
import DurationInput from './DurationInput.jsx';

const CATEGORY_OPTIONS = [
  { value: 'object', label: 'Object' },
  { value: 'bucket', label: 'Bucket' },
  { value: 'access', label: 'Access' },
];

const OPERATOR_OPTIONS = [
  { value: '=', label: '= (equals)' },
  { value: '!=', label: '!= (not equals)' },
  { value: '<', label: '< (less)' },
  { value: '<=', label: '<= (less or equal)' },
  { value: '>', label: '> (greater)' },
  { value: '>=', label: '>= (greater or equal)' },
  { value: '~', label: '~ (matches/contains)' },
  { value: '!~', label: '!~ (does not match)' },
  { value: 'in', label: 'in (in list)' },
  { value: 'not in', label: 'not in (not in list)' },
  { value: 'exists', label: 'exists' },
];

const ACTION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'drop', label: 'Drop' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'pass', label: 'Pass' },
  { value: 'log', label: 'Log' },
  { value: 'set', label: 'Set' },
  { value: 'propagate', label: 'Propagate' },
];

const FIELD_OPTIONS_BY_CATEGORY = {
  access: [
    { value: 'source.cluster', label: 'Source cluster' },
    { value: 'source.credential', label: 'Source credential' },
    { value: 'destination.cluster', label: 'Destination cluster' },
    { value: 'destination.credential', label: 'Destination credential' },
    { value: 'user.name', label: 'User name' },
    { value: 'user.id', label: 'User ID' },
  ],
  bucket: [
    { value: 'source.name', label: 'Source bucket name' },
    { value: 'destination.name', label: 'Destination bucket name' },
    { value: 'source.versioning', label: 'Source versioning' },
    { value: 'destination.versioning', label: 'Destination versioning' },
    { value: 'bucket.location', label: 'Bucket location' },
  ],
  object: [
    { value: 'source.key', label: 'Object key' },
    { value: 'source.size', label: 'Object size' },
    { value: 'source.content_type', label: 'Content-Type' },
    { value: 'source.storage_class', label: 'Storage class' },
    { value: 'source.last_modified', label: 'Last modified' },
    { value: 'source.etag', label: 'ETag' },
    { value: 'source.tags', label: 'Object tags' },
    { value: 'source.user_meta', label: 'User metadata' },
    { value: 'source.extension', label: 'File extension' },
  ],
};

// Quote a token so that it survives the server-side shell-like tokenizer.
function quote(value) {
  const s = String(value ?? '');
  if (s !== '' && !/[\s'"\\]/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Rules coming from the server carry actions as text ("redirect batch1",
// "quarantine name=q"); convert them to the editor's structured form.
function parseActionText(text) {
  if (text && typeof text === 'object') return text;
  const tokens = String(text || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const [name = 'accept', ...rest] = tokens;
  const unq = (v) => v.replace(/^(["'])(.*)\1$/, '$2').replace(/=(["'])(.*)\1$/, '=$2');
  const params: any = {};
  let positional = '';
  rest.forEach((tok) => {
    const t = unq(tok);
    const eq = t.indexOf('=');
    if (eq > 0) params[t.slice(0, eq)] = t.slice(eq + 1).replace(/^(["'])(.*)\1$/, '$2');
    else if (!positional) positional = t;
  });
  if (name === 'quarantine' && params.name) positional = params.name;
  if (name === 'set') {
    const [field] = Object.keys(params);
    return { name, positional: '', params: field ? { field, value: params[field] } : {} };
  }
  if (name === 'propagate') {
    const what = positional || Object.keys(params)[0] || '';
    return { name, positional: '', params: { what } };
  }
  return { name, positional, params };
}

function isSizeField(field) {
  return field === 'source.size';
}

function isTimeField(field) {
  return field === 'source.last_modified';
}

function ValueInput({ field, op, value, onChange }) {
  if (op === 'exists') {
    return <Input value="true" disabled style={{ width: '100%' }} />;
  }
  if (op === 'in' || op === 'not in') {
    return (
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder="Add values (press Enter)"
        value={value ? String(value).split(',').filter(Boolean) : []}
        onChange={(vals) => onChange(vals.join(','))}
        tokenSeparators={[',', ';']}
      />
    );
  }
  if (isSizeField(field)) {
    return <SizeInput value={value} onChange={onChange} />;
  }
  if (isTimeField(field)) {
    return <DurationInput value={value} onChange={onChange} />;
  }
  if (field.includes('content_type')) {
    return (
      <Select
        style={{ width: '100%' }}
        value={value || undefined}
        placeholder="Select content type"
        allowClear
        showSearch
        options={[
          { value: 'application/octet-stream', label: 'application/octet-stream' },
          { value: 'text/plain', label: 'text/plain' },
          { value: 'text/html', label: 'text/html' },
          { value: 'application/json', label: 'application/json' },
          { value: 'application/xml', label: 'application/xml' },
          { value: 'image/jpeg', label: 'image/jpeg' },
          { value: 'image/png', label: 'image/png' },
          { value: 'image/gif', label: 'image/gif' },
          { value: 'application/zip', label: 'application/zip' },
          { value: 'application/pdf', label: 'application/pdf' },
        ]}
        onChange={(v) => onChange(v || '')}
      />
    );
  }
  if (field.includes('storage_class')) {
    return (
      <Select
        style={{ width: '100%' }}
        value={value || undefined}
        placeholder="Select storage class"
        allowClear
        options={[
          { value: 'STANDARD', label: 'STANDARD' },
          { value: 'REDUCED_REDUNDANCY', label: 'REDUCED_REDUNDANCY' },
          { value: 'GLACIER', label: 'GLACIER' },
          { value: 'DEEP_ARCHIVE', label: 'DEEP_ARCHIVE' },
          { value: 'INTELLIGENT_TIERING', label: 'INTELLIGENT_TIERING' },
        ]}
        onChange={(v) => onChange(v || '')}
      />
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter value" />;
}

function ConditionRow({ condition, index, onChange, onRemove, fields, canRemove }) {
  const { logic = index === 0 ? '' : 'and', field = '', op = '=', value = '' } = condition || {};
  
  const fieldOptions = useMemo(() => fields, [fields]);
  
  const handleChange = (key, val) => {
    onChange({ ...condition, [key]: val });
  };
  
  return (
    <Card size="small" style={{ marginBottom: 8, background: 'var(--ant-color-bg-container)' }}>
      <Row gutter={[8, 8]} align="middle">
        <Col xs={24} sm={4} md={3}>
          {index === 0 ? (
            <Tag style={{ margin: 0 }}>IF</Tag>
          ) : (
            <Select
              value={logic || 'and'}
              style={{ width: '100%' }}
              options={[
                { value: 'and', label: 'AND' },
                { value: 'or', label: 'OR' },
                { value: 'not', label: 'NOT' },
              ]}
              onChange={(v) => handleChange('logic', v)}
            />
          )}
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            value={field || undefined}
            style={{ width: '100%' }}
            placeholder="Select field"
            showSearch
            options={fieldOptions}
            onChange={(v) => {
              handleChange('field', v);
              // Reset value when field changes
              if (isSizeField(v) && value && !/^[0-9.]+\s*[KMGTBkmgtb]*$/.test(String(value))) {
                handleChange('value', '');
              }
            }}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Select
            value={op}
            style={{ width: '100%' }}
            options={OPERATOR_OPTIONS}
            onChange={(v) => handleChange('op', v)}
          />
        </Col>
        <Col xs={24} sm={12} md={9}>
          <ValueInput field={field} op={op} value={value} onChange={(v) => handleChange('value', v)} />
        </Col>
        <Col xs={24} sm={2} md={2} style={{ textAlign: 'right' }}>
          {canRemove && (
            <Tooltip title="Remove condition">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} size="small" />
            </Tooltip>
          )}
        </Col>
      </Row>
    </Card>
  );
}

function ActionRow({ action, onChange, onRemove, canRemove }) {
  const { name = 'accept', params = {}, positional = '' } = action || {};
  
  const handleChange = (key, val) => {
    onChange({ ...action, [key]: val });
  };
  
  const handleParamChange = (key, val) => {
    onChange({ ...action, params: { ...(params || {}), [key]: val } });
  };
  
  const needsPositional = name === 'redirect' || name === 'quarantine';
  const needsFieldValue = name === 'set';
  const needsWhat = name === 'propagate';
  const needsMessage = name === 'log';
  
  return (
    <Card size="small" style={{ marginBottom: 8, background: 'var(--ant-color-bg-container)' }}>
      <Row gutter={[8, 8]} align="middle">
        <Col xs={24} sm={8} md={5}>
          <Select
            value={name}
            style={{ width: '100%' }}
            options={ACTION_OPTIONS}
            onChange={(v) => {
              onChange({ ...action, name: v, params: {}, positional: '' });
            }}
          />
        </Col>
        {needsPositional && (
          <Col xs={24} sm={10} md={8}>
            <Input
              value={positional}
              onChange={(e) => handleChange('positional', e.target.value)}
              placeholder={name === 'redirect' ? 'Target batch name' : 'Quarantine name'}
            />
          </Col>
        )}
        {needsFieldValue && (
          <>
            <Col xs={24} sm={10} md={7}>
              <Input
                value={params?.field || ''}
                onChange={(e) => handleParamChange('field', e.target.value)}
                placeholder="Field to set"
              />
            </Col>
            <Col xs={24} sm={10} md={7}>
              <Input
                value={params?.value || ''}
                onChange={(e) => handleParamChange('value', e.target.value)}
                placeholder="Value"
              />
            </Col>
          </>
        )}
        {needsWhat && (
          <Col xs={24} sm={10} md={8}>
            <Select
              value={params?.what || undefined}
              style={{ width: '100%' }}
              placeholder="What to propagate"
              options={[
                { value: 'settings', label: 'Settings' },
                { value: 'tags', label: 'Tags' },
                { value: 'metadata', label: 'Metadata' },
                { value: 'policy', label: 'Policy' },
                { value: 'acl', label: 'ACL' },
              ]}
              onChange={(v) => handleParamChange('what', v)}
            />
          </Col>
        )}
        {needsMessage && (
          <Col xs={24} sm={14} md={12}>
            <Input
              value={params?.message || ''}
              onChange={(e) => handleParamChange('message', e.target.value)}
              placeholder="Log message"
            />
          </Col>
        )}
        <Col xs={24} sm={2} md={2} style={{ textAlign: 'right', marginLeft: 'auto' }}>
          {canRemove && (
            <Tooltip title="Remove action">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} size="small" />
            </Tooltip>
          )}
        </Col>
      </Row>
    </Card>
  );
}

export default function RuleEditor({ initialRule, onSave, onCancel }) {
  // the server reports the access category as 'acl'
  const [category, setCategory] = useState(initialRule?.category === 'acl' ? 'access' : (initialRule?.category || 'object'));
  const [order, setOrder] = useState(initialRule?.order || 1);
  const [name, setName] = useState(initialRule?.name || '');
  const [description, setDescription] = useState(initialRule?.description || '');
  
  const [conditions, setConditions] = useState(() => {
    if (initialRule?.conditions && Array.isArray(initialRule.conditions) && initialRule.conditions.length > 0) {
      return initialRule.conditions;
    }
    return [{ field: '', op: '=', value: '', logic: '' }];
  });
  // Server rules only expose the condition as text; keep it editable verbatim so
  // that editing a rule does not silently turn it into a match-all rule.
  const [rawCondition, setRawCondition] = useState(() => (initialRule?.conditions?.length ? '' : (initialRule?.condition || '')));
  
  const [actions, setActions] = useState(() => {
    if (initialRule?.actions && Array.isArray(initialRule.actions) && initialRule.actions.length > 0) {
      return initialRule.actions.map(parseActionText);
    }
    return [{ name: 'accept', params: {}, positional: '' }];
  });
  
  const fieldOptions = useMemo(() => {
    return FIELD_OPTIONS_BY_CATEGORY[category] || FIELD_OPTIONS_BY_CATEGORY.object;
  }, [category]);
  
  const buildRuleText = () => {
    const condStr = conditions
      .filter((c) => c.field && c.op)
      .map((c, i) => {
        const prefix = i === 0 ? '' : ` ${c.logic || 'and'} `;
        if (c.op === 'exists') {
          return `${prefix}${c.field} exists`;
        }
        if (c.op === 'in' || c.op === 'not in') {
          // server grammar: `field in a,b,c` (no brackets); negation is `not field in ...`
          const vals = c.value ? String(c.value).split(',').map((v: any) => v.trim()).filter(Boolean) : [];
          return `${prefix}${c.op === 'not in' ? 'not ' : ''}${c.field} in ${quote(vals.join(','))}`;
        }
        return `${prefix}${c.field} ${c.op} ${quote(c.value)}`;
      })
      .join('');
    
    const actionStr = actions
      .map((a: any) => {
        if (a.name === 'set') {
          return `${a.name} ${a.params?.field || ''}=${quote(a.params?.value || '')}`;
        }
        if (a.name === 'propagate') {
          // propagate takes key=value parameters only (e.g. `propagate settings=true`)
          return a.params?.what ? `${a.name} ${a.params.what}=true` : a.name;
        }
        if (a.name === 'log') {
          const msg = a.params?.message || '';
          return msg ? `${a.name} message=${quote(msg)}` : a.name;
        }
        if (a.name === 'redirect') {
          return a.positional ? `${a.name} ${quote(a.positional)}` : a.name;
        }
        if (a.name === 'quarantine') {
          // quarantine has no positional argument: the target goes into name=
          return a.positional ? `${a.name} name=${quote(a.positional)}` : a.name;
        }
        return a.name;
      })
      .join(', ');
    
    const cond = condStr.trim() || rawCondition.trim();
    const head = name.trim() ? `name=${quote(name.trim())} ${category}` : category;
    if (!cond) {
      return `${head} action ${actionStr}`;
    }
    return `${head} ${cond} action ${actionStr}`;
  };
  
  const handleSave = () => {
    const ruleLine = buildRuleText();
    onSave({
      category,
      order,
      name,
      description,
      conditions,
      actions,
      line: ruleLine,
    });
  };
  
  const addCondition = () => {
    setConditions([...conditions, { field: fieldOptions[0]?.value || '', op: '=', value: '', logic: 'and' }]);
  };
  
  const updateCondition = (index, changes) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...changes };
    setConditions(newConditions);
  };
  
  const removeCondition = (index) => {
    if (conditions.length === 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
  };
  
  const addAction = () => {
    setActions([...actions, { name: 'accept', params: {}, positional: '' }]);
  };
  
  const updateAction = (index, changes) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...changes };
    setActions(newActions);
  };
  
  const removeAction = (index) => {
    if (actions.length === 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };
  
  return (
    <div style={{ padding: '8px 0' }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        {initialRule ? 'Edit Rule' : 'Create Rule'}
      </Typography.Title>
      
      <Card size="small" title="Rule Settings" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>Category</div>
            <Select
              value={category}
              style={{ width: '100%' }}
              options={CATEGORY_OPTIONS}
              onChange={(v) => {
                setCategory(v);
                setConditions(conditions.map((c: any) => ({ ...c, field: (FIELD_OPTIONS_BY_CATEGORY[v] || [])[0]?.value || '' })));
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>Order/Priority</div>
            <InputNumber min={1} value={order} onChange={setOrder} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>Rule Name (optional)</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Block large objects" />
          </Col>
          <Col xs={24}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>Description (optional)</div>
            <Input.TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this rule does" />
          </Col>
        </Row>
      </Card>
      
      <Card size="small" title="Conditions" extra={<Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondition}>Add Condition</Button>} style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Define when this rule should match. First condition has no logical operator.
        </Typography.Text>
        {rawCondition && !conditions.some((c: any) => c.field) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>Current condition (used unless structured conditions are set)</div>
            <Input value={rawCondition} onChange={(e) => setRawCondition(e.target.value)} style={{ fontFamily: 'monospace' }} />
          </div>
        )}
        {conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            index={i}
            fields={fieldOptions}
            onChange={(changes) => updateCondition(i, changes)}
            onRemove={() => removeCondition(i)}
            canRemove={conditions.length > 1}
          />
        ))}
      </Card>
      
      <Card size="small" title="Actions" extra={<Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addAction}>Add Action</Button>} style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Define what happens when conditions match. Typically use one terminal action (accept/drop/quarantine/redirect/pass).
        </Typography.Text>
        {actions.map((action, i) => (
          <ActionRow
            key={i}
            action={action}
            onChange={(changes) => updateAction(i, changes)}
            onRemove={() => removeAction(i)}
            canRemove={actions.length > 1}
          />
        ))}
      </Card>
      
      <Card size="small" title="Rule Preview" style={{ marginBottom: 16 }}>
        <Input.TextArea
          value={buildRuleText()}
          readOnly
          rows={3}
          style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--ant-color-fill-quaternary)' }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          This is the canonical rule syntax that will be sent to the server
        </Typography.Text>
      </Card>
      
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={handleSave}>Save Rule</Button>
      </Space>
    </div>
  );
}
