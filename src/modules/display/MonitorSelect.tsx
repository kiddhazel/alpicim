import { t } from '../../i18n';
import { Select } from '../../shared/ui/primitives';
import { monitorNumber, type DisplaySnapshot } from './displayService';

/** Hedef monitör seçimi: "Otomatik" (ikinci ekran, yoksa birincil) veya belirli bir monitör. */
export function MonitorSelect({
  snapshot,
  onChange,
  className,
}: {
  snapshot: DisplaySnapshot;
  onChange: (monitor: string | null) => void;
  className?: string;
}) {
  return (
    <Select
      value={snapshot.prefs.monitor ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={t('display.monitor')}
      className={className}
    >
      <option value="">{t('display.auto')}</option>
      {snapshot.monitors.map((m, i) => (
        <option key={m.id} value={m.id}>
          {t('display.monitorLabel', {
            n: monitorNumber(m, i),
            w: m.width,
            h: m.height,
            scale: Math.round(m.scale * 100),
          })}
          {m.primary ? ` · ${t('display.primary')}` : ''}
          {m.current ? ` · ${t('display.current')}` : ''}
        </option>
      ))}
    </Select>
  );
}
