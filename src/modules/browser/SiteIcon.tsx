import { useState } from 'react';
import { cx } from '../../shared/ui/primitives';
import { useIntegrationEnabled } from '../integrations/useIntegrations';
import { faviconUrl, hostOf } from './browserService';

/**
 * Site simgesi. "Google site simgeleri" entegrasyonu kapalıysa (ya da simge yüklenemezse) ağa çıkmadan
 * alan adının baş harfi gösterilir.
 */
export function SiteIcon({ url, size, className, lazy }: { url: string; size: 16 | 28; className?: string; lazy?: boolean }) {
  const enabled = useIntegrationEnabled('favicons');
  const [broken, setBroken] = useState<string | null>(null);
  const box = size === 16 ? 'h-4 w-4 text-xs' : 'h-7 w-7 text-sm';

  if (enabled !== true || broken === url) {
    const letter = (hostOf(url).charAt(0) || '?').toLocaleUpperCase('tr-TR');
    return (
      <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center bg-accent-soft font-semibold text-accent', box, className)}>
        {letter}
      </span>
    );
  }
  return (
    <img
      src={faviconUrl(url)}
      alt=""
      width={size}
      height={size}
      loading={lazy ? 'lazy' : undefined}
      className={cx('shrink-0', box, className)}
      onError={() => setBroken(url)}
    />
  );
}
