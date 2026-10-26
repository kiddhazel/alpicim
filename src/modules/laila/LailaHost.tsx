import { Laila } from './Laila';
import { useSettings } from '../settings/settings';
import type { ServiceProps } from '../../core/modules/types';

/** Kabuk üst katmanı: Laila, ayarlarda açıksa gösterilir (modül kapalıyken hiç bağlanmaz). */
export default function LailaHost({ hostRef, panel }: ServiceProps) {
  const [settings] = useSettings();
  if (!settings.lailaEnabled || !hostRef) return null;
  return <Laila hostRef={hostRef} panel={panel} />;
}
