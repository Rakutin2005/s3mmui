import { Table, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

// dnd-kit ids must be stable and truthy (order 0 would be dropped by `order || key`)
const rowId = (r: any) => String(r.order ?? r.key);

function SortableRow({ children, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });

  const style = {
    ...props.style,
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    cursor: 'move',
    ...(isDragging ? { position: 'relative', zIndex: 9999, opacity: 0.8 } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </tr>
  );
}

const EMPTY: any[] = [];

export default function SortableRulesTable({ dataSource = EMPTY, onEdit, onDelete, onReorder }: { dataSource?: any[]; onEdit?: any; onDelete?: any; onReorder?: any }) {
  const [items, setItems] = useState(dataSource);
  const [source, setSource] = useState(dataSource);
  // Follow server updates (rule added/removed/reordered): adjust state during render.
  if (source !== dataSource) {
    setSource(dataSource);
    setItems(dataSource);
  }

  const sensors = useSensors(
    // small distance so clicks on the Edit/Remove buttons are not swallowed by a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => rowId(item) === active.id);
      const newIndex = items.findIndex((item) => rowId(item) === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onReorder?.(newItems, items[oldIndex], items[newIndex], oldIndex, newIndex);
    }
  };

  const columns = [
    {
      title: '',
      width: 40,
      render: () => (
        <DragOutlined style={{ cursor: 'grab', color: 'var(--ant-color-text-tertiary)' }} />
      ),
    },
    { title: 'Order', dataIndex: 'order', width: 80 },
    { title: 'Name', dataIndex: 'name', width: 150 },
    { title: 'Category', dataIndex: 'category', width: 100 },
    { title: 'Condition', dataIndex: 'condition', ellipsis: true },
    { title: 'Actions', dataIndex: 'actions', render: (v) => (v || []).join(', '), width: 200 },
    {
      title: 'Actions',
      width: 150,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit?.(r)}>Edit</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={() => onDelete?.(r)}>Remove</Button>
        </Space>
      ),
    },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={(items || []).map(rowId)} strategy={verticalListSortingStrategy}>
        <Table
          rowKey={rowId}
          dataSource={items || dataSource}
          pagination={false}
          columns={columns}
          components={{
            body: {
              row: (props) => <SortableRow {...props} />,
            },
          }}
        />
      </SortableContext>
    </DndContext>
  );
}
