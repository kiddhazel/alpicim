import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t } from '../../i18n';
import { Button, cx, IconButton, TextInput } from '../../shared/ui/primitives';

export interface ChatMessage {
  id: number;
  from: 'laila' | 'user';
  text: string;
}

interface Props {
  messages: ChatMessage[];
  /** Sohbet kutusunun ana alanın altından uzaklığı (px). */
  bottom: number;
  onSend: (text: string) => void;
  onClose: () => void;
}

/** Laila ile sohbet açılır penceresi (hazır cümlelerle yanıt verir). */
export function LailaChat({ messages, bottom, onSend, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(draft);
    setDraft('');
  };

  return (
    <div
      role="dialog"
      aria-label={t('laila.chatTitle')}
      style={{ bottom, width: 320, height: 380 }}
      className="glass pointer-events-auto absolute right-3 flex max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl shadow-panel"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="flex h-11 shrink-0 items-center justify-between pr-1.5 pl-4">
        <span className="text-sm font-semibold">{t('laila.chatTitle')}</span>
        <IconButton icon={X} size="sm" label={t('laila.chatClose')} onClick={onClose} />
      </div>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cx(
              'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
              m.from === 'laila' ? 'self-start rounded-bl-md bg-surface-3' : 'bg-accent-gradient self-end rounded-br-md text-white',
            )}
          >
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 p-3">
        <TextInput
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('laila.chatPlaceholder')}
          aria-label={t('laila.chatPlaceholder')}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" icon={Send}>
          {t('laila.chatSend')}
        </Button>
      </form>
    </div>
  );
}
