import { useCallback, useEffect, useRef, useState } from 'react';
import { netGetOk } from '../../../shared/lib/net';
import { readKey, writeKey } from '../../../shared/lib/store';
import { AppError } from '../../../shared/lib/tauri';
import { usePersistentState } from '../../../shared/lib/usePersistentState';
import { useInterval } from '../../../shared/lib/hooks';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';
import { addDays, toDateKey, type CalendarEvent } from './calendar';
import { normalizeIcsUrl, parseIcs } from './ics';

/** Kullanıcının girdiği abonelik adresi uygulama deposunda durur (depoya/koda yazılmaz). */
export const ICS_URL_KEY = 'calendar.icsUrl';

export function sanitizeIcsUrl(raw: unknown): string {
  return typeof raw === 'string' ? (normalizeIcsUrl(raw) ?? '') : '';
}

export async function loadIcsUrl(): Promise<string> {
  return sanitizeIcsUrl(await readKey<unknown>(ICS_URL_KEY, ''));
}

/** Boş metin adresi siler; geçersizse AppError('PARSE') fırlatır. */
export async function saveIcsUrl(input: string): Promise<string> {
  const text = input.trim();
  if (!text) {
    await writeKey(ICS_URL_KEY, '');
    return '';
  }
  const url = normalizeIcsUrl(text);
  if (!url) throw new AppError('PARSE', 'ics-url');
  await writeKey(ICS_URL_KEY, url);
  return url;
}

/** Bugünden 45 gün öncesi ile 1 yıl sonrası arasındaki oluşumlar. */
export async function fetchIcsEvents(url: string, today: string = toDateKey(new Date())): Promise<CalendarEvent[]> {
  await assertIntegrationEnabled('ics');
  const res = await netGetOk({ url });
  if (!/BEGIN:VCALENDAR/i.test(res.body)) throw new AppError('PARSE', 'ics');
  return parseIcs(res.body, addDays(today, -45), addDays(today, 365));
}

/** "Test et": kayıtlı adresi indirip ayrıştırır. */
export async function testIcs(): Promise<number> {
  const url = await loadIcsUrl();
  if (!url) throw new AppError('API_KEY_MISSING', 'ics');
  return (await fetchIcsEvents(url)).length;
}

const REFRESH_MS = 30 * 60_000;

/** Abonelik etkinlikleri (salt okunur); görünür değilken yenilenmez. Adres yoksa boş. */
export function useIcsEvents(active: boolean): { events: CalendarEvent[]; error: unknown } {
  const [url] = usePersistentState<string>(ICS_URL_KEY, '', sanitizeIcsUrl);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const pull = useCallback(() => {
    if (!url || busy.current) return;
    busy.current = true;
    fetchIcsEvents(url)
      .then((list) => {
        setEvents(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err))
      .finally(() => {
        busy.current = false;
      });
  }, [url]);
  useEffect(() => {
    if (!url) {
      setEvents([]);
      setError(null);
    } else if (active) {
      pull();
    }
  }, [url, active, pull]);
  useInterval(pull, active && url ? REFRESH_MS : null);
  return { events, error };
}
