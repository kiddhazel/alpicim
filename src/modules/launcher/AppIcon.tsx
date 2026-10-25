import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../shared/ui/primitives';
import { loadIcon } from './launcherService';

interface Props {
  /** Simgesi gösterilecek dosya (.exe, .lnk, .url, klasör) */
  path: string;
  /** Windows simgesi alınamazsa gösterilecek ikon */
  fallback: LucideIcon;
  size?: number;
  className?: string;
}

/** Uygulamanın kendi Windows simgesi; yüklenene kadar/başarısız olursa Lucide ikonu. */
export function AppIcon({ path, fallback: Fallback, size = 32, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    void loadIcon(path).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [path]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        width={size}
        height={size}
        className={cx('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <Fallback aria-hidden size={Math.round(size * 0.62)} strokeWidth={1.75} className={cx('shrink-0', className)} />;
}
