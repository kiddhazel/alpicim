import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { t } from '../../i18n';
import { usePageVisible } from '../../shared/lib/hooks';
import { cx, IconButton } from '../../shared/ui/primitives';
import { useToast } from '../../shared/ui/Toast';
import { describeError } from '../../shared/ui/StateView';
import { useSettings } from '../settings/settings';
import { sourceName, useMediaSession, type MediaAction } from './systemService';

/**
 * Windows medya oturumu (SMTC) denetimleri. Parça bilgisi yalnızca Windows'un bildirdiği kadarıyla gösterilir;
 * oturum yoksa düğmeler pasif kalır (uydurma bilgi gösterilmez).
 */
export function MediaControls({ compact, preferOwn = true, className }: { compact?: boolean; preferOwn?: boolean; className?: string }) {
  const [settings] = useSettings();
  const visible = usePageVisible();
  const toast = useToast();
  const { session, command } = useMediaSession(settings.performanceMode ? 6000 : 2500, visible, preferOwn);
  const playing = session?.status === 'playing';

  const run = (action: MediaAction) => {
    command(action).catch((err: unknown) => toast.push('error', describeError(err).description));
  };

  return (
    <div className={cx('flex min-w-0 items-center gap-1', className)}>
      <IconButton icon={SkipBack} label={t('media.previous')} disabled={!session?.canPrevious} onClick={() => run('previous')} />
      <IconButton
        icon={playing ? Pause : Play}
        label={playing ? t('media.pause') : t('media.play')}
        disabled={!session?.canPlayPause}
        onClick={() => run('playPause')}
      />
      <IconButton icon={SkipForward} label={t('media.next')} disabled={!session?.canNext} onClick={() => run('next')} />
      <div className={cx('min-w-0', compact ? 'max-w-56' : 'flex-1')}>
        {session && session.title ? (
          <p className="truncate text-sm" title={`${session.title} — ${session.artist} (${sourceName(session.appId)})`}>
            <span className="font-medium text-fg">{session.title}</span>
            {session.artist && <span className="text-muted"> · {session.artist}</span>}
            {!session.own && <span className="text-faint"> · {sourceName(session.appId)}</span>}
          </p>
        ) : (
          <p className="truncate text-sm text-faint">{t('media.none')}</p>
        )}
      </div>
    </div>
  );
}
