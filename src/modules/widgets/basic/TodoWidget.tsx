import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { cx, IconButton, TextInput } from '../../../shared/ui/primitives';
import { celebrate } from '../../fx/confetti';
import { track } from '../../../shared/lib/track';
import { obj, type WidgetProps } from '../types';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoConfig {
  items: TodoItem[];
}

export const todoDefaults: TodoConfig = { items: [] };

export function sanitizeTodo(raw: unknown): TodoConfig {
  const items = obj(raw).items;
  if (!Array.isArray(items)) return { items: [] };
  return {
    items: items
      .filter((i): i is TodoItem => !!i && typeof i.id === 'string' && typeof i.text === 'string')
      .slice(0, 200)
      .map((i) => ({ id: i.id, text: i.text.slice(0, 300), done: i.done === true })),
  };
}

export function addTodo(items: readonly TodoItem[], text: string): TodoItem[] {
  const clean = text.trim();
  if (!clean) return [...items];
  return [...items, { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: clean.slice(0, 300), done: false }];
}

export function TodoWidget({ config, setConfig }: WidgetProps<TodoConfig>) {
  const [text, setText] = useState('');
  const items = config.items;
  const remaining = items.filter((i) => !i.done).length;
  const set = (next: TodoItem[]) => setConfig({ items: next });

  return (
    <div className="flex h-full flex-col">
      <form
        className="flex gap-2 px-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          set(addTodo(items, text));
          setText('');
        }}
      >
        <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder={t('widgets.todo.placeholder')} className="min-w-0 flex-1 text-sm" />
        <IconButton size="sm" icon={Plus} label={t('common.add')} type="submit" disabled={!text.trim()} />
      </form>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {items.length === 0 && <li className="px-1 py-3 text-center text-sm text-fg-3">{t('widgets.todo.empty')}</li>}
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-control-hover">
            <input
              type="checkbox"
              checked={item.done}
              aria-label={item.text}
              onChange={(e) => {
                if (!item.done) {
                  track('todo.done');
                  const r = e.currentTarget.getBoundingClientRect();
                  celebrate({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }
                set(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
              }}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className={cx('selectable min-w-0 flex-1 truncate text-sm', item.done && 'text-fg-3 line-through')} title={item.text}>
              {item.text}
            </span>
            <button
              type="button"
              aria-label={t('common.remove')}
              onClick={() => set(items.filter((i) => i.id !== item.id))}
              className="rounded p-1 text-fg-3 opacity-0 group-hover:opacity-100 hover:text-down focus:opacity-100"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-stroke px-4 py-1.5 text-xs text-fg-3">
        <span>{t('widgets.todo.remaining', { n: remaining })}</span>
        {items.some((i) => i.done) && (
          <button type="button" className="inline-flex items-center gap-1 hover:text-down" onClick={() => set(items.filter((i) => !i.done))}>
            <Trash2 size={12} />
            {t('widgets.todo.clearDone')}
          </button>
        )}
      </div>
    </div>
  );
}
