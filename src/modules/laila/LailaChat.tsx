import { Coffee, Cookie, Cherry, Heart, Moon, Send, Shirt, Smile, Utensils, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t } from '../../i18n';
import { Button, cx, IconButton, TextInput } from '../../shared/ui/primitives';
import { LEVEL_THRESHOLDS, levelOf, type Bond } from './bond';
import { SNACKS, snackReadyIn, type Needs, type SnackId } from './needs';
import { OUTFITS, PALETTE, outfitDef, type OutfitId } from './sprite';

export interface ChatMessage {
  id: number;
  from: 'laila' | 'user';
  text: string;
}

interface Props {
  messages: ChatMessage[];
  /** Sohbet kutusunun ana alanın altından uzaklığı (px). */
  bottom: number;
  bond: Bond;
  needs: Needs;
  onFeed: (id: SnackId) => void;
  onSend: (text: string) => void;
  onPickOutfit: (id: OutfitId) => void;
  onClose: () => void;
}

const SNACK_ICONS: Record<SnackId, LucideIcon> = { strawberry: Cherry, cookie: Cookie, tea: Coffee };

function NeedBar({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1 text-fg-2" title={`${label}: ${Math.round(value)}`}>
      <Icon size={12} strokeWidth={1.75} aria-hidden />
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-control" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <span className={cx('block h-full rounded-full', value < 25 ? 'bg-down' : 'bg-accent')} style={{ width: `${Math.round(value)}%` }} />
      </span>
    </span>
  );
}

const LEVEL_KEYS = ['laila.bondLevel.l0', 'laila.bondLevel.l1', 'laila.bondLevel.l2', 'laila.bondLevel.l3', 'laila.bondLevel.l4'] as const;

/** Laila ile sohbet açılır penceresi (hazır cümlelerle yanıt verir) + bağ ölçeri ve kıyafet seçimi. */
export function LailaChat({ messages, bottom, bond, needs, onFeed, onSend, onPickOutfit, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, picking]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(draft);
    setDraft('');
  };

  const level = levelOf(bond.points);
  const levelKey = LEVEL_KEYS[Math.min(level.index, LEVEL_KEYS.length - 1)]!;

  return (
    <div
      role="dialog"
      aria-label={t('laila.chatTitle')}
      style={{ bottom, width: 320, height: 380 }}
      className="pointer-events-auto absolute right-3 flex max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-stroke-strong shadow-[var(--shadow-pop)]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="flex h-11 shrink-0 items-center justify-between pr-1.5 pl-4">
        <span className="text-sm font-semibold">{t('laila.chatTitle')}</span>
        <div className="flex items-center">
          <IconButton icon={Shirt} size="sm" label={t('laila.outfits')} active={picking} onClick={() => setPicking((p) => !p)} />
          <IconButton icon={X} size="sm" label={t('laila.chatClose')} onClick={onClose} />
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-2 px-4 pb-2 text-xs text-fg-2"
        title={level.next !== null ? t('laila.bondNext', { next: level.next }) : undefined}
      >
        <span className="flex items-center gap-0.5" aria-hidden>
          {LEVEL_THRESHOLDS.map((_, i) => (
            <Heart key={i} size={14} strokeWidth={1.75} className={i <= level.index ? 'fill-current text-accent' : 'text-fg-3'} />
          ))}
        </span>
        <span className="font-medium text-fg">{t(levelKey)}</span>
        <span>· {t('laila.bondPoints', { points: bond.points })}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <NeedBar icon={Utensils} label={t('laila.needHunger')} value={needs.hunger} />
        <NeedBar icon={Smile} label={t('laila.needFun')} value={needs.fun} />
        <NeedBar icon={Moon} label={t('laila.needEnergy')} value={needs.energy} />
      </div>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        {picking ? (
          <div className="grid grid-cols-2 gap-2">
            {OUTFITS.map((o) => {
              const locked = o.points > bond.points;
              const selected = bond.outfit === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={selected}
                  onClick={() => onPickOutfit(o.id)}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-lg bg-layer p-2.5 text-sm transition-colors',
                    selected ? 'ring-2 ring-accent' : 'ring-1 ring-stroke',
                    locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-control-hover',
                  )}
                >
                  <span className="flex h-8 w-8 overflow-hidden rounded-full ring-1 ring-stroke" aria-hidden>
                    <span className="h-full w-1/2" style={{ background: outfitDef(o.id).colors.c ?? PALETTE.c }} />
                    <span className="h-full w-1/2" style={{ background: outfitDef(o.id).colors.h ?? PALETTE.h }} />
                  </span>
                  <span className="font-medium">{t(`laila.outfit.${o.id}`)}</span>
                  {locked && <span className="text-xs text-fg-2">{t('laila.outfitLocked', { points: o.points })}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                m.from === 'laila' ? 'self-start bg-control text-fg' : 'bg-accent text-on-accent self-end',
              )}
            >
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 px-3" aria-label={t('laila.feed')}>
        {SNACKS.map((s) => {
          const wait = snackReadyIn(needs, s.id, now);
          const Icon = SNACK_ICONS[s.id];
          return (
            <button
              key={s.id}
              type="button"
              disabled={wait > 0}
              onClick={() => onFeed(s.id)}
              title={wait > 0 ? `${t(`laila.snack.${s.id}`)} (${Math.ceil(wait / 1000)}s)` : t(`laila.snack.${s.id}`)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-layer text-xs font-medium ring-1 ring-stroke transition-colors hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon size={14} strokeWidth={1.75} />
              {t(`laila.snack.${s.id}`)}
            </button>
          );
        })}
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
