import { useEffect } from 'react';
import { t } from '../../i18n';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { addShotToNote, onSnipDone, screenshotService } from './screenshotService';

/** Ana pencerede: ekran görüntüsü kaydedilince "Klasörü aç" / "Nota ekle" eylemli bildirim gösterir. */
export function SnipListener() {
  const toast = useToast();
  useEffect(
    () =>
      onSnipDone((path) => {
        const fail = (e: unknown) => toast.push('error', describeError(e).description);
        toast.push('success', t('screenshot.saved'), [
          { label: t('screenshot.openFolder'), onClick: () => void screenshotService.reveal(path).catch(fail) },
          {
            label: t('screenshot.addNote'),
            onClick: () =>
              void addShotToNote(path)
                .then(() => toast.push('success', t('screenshot.noteAdded')))
                .catch(fail),
          },
        ]);
      }),
    [toast],
  );
  return null;
}
