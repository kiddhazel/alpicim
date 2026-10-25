import { faviconUrl, hostOf, toUrl } from '../../browser/browserService';
import { obj } from '../types';

export interface QuickLink {
  id: string;
  title: string;
  url: string;
}

export interface LinksConfig {
  links: QuickLink[];
}

export const MAX_LINKS = 60;
export const linksDefaults: LinksConfig = { links: [] };

/** Girdiyi http/https adresine çevirir; geçersizse null. Arama metni adres sayılmaz. */
export function normalizeLinkUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const url = toUrl(text);
  if (url.startsWith('https://www.google.com/search?q=') && !/google\.com/i.test(text)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href.length <= 2000 ? u.href : null;
  } catch {
    return null;
  }
}

export function linkTitle(link: QuickLink): string {
  return link.title || hostOf(link.url);
}

export { faviconUrl };

export function addLink(links: readonly QuickLink[], title: string, urlInput: string): QuickLink[] {
  const url = normalizeLinkUrl(urlInput);
  if (!url || links.length >= MAX_LINKS) return [...links];
  const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [...links, { id, title: title.trim().slice(0, 60), url }];
}

export function removeLink(links: readonly QuickLink[], id: string): QuickLink[] {
  return links.filter((l) => l.id !== id);
}

/** Bir öğeyi yukarı (-1) ya da aşağı (+1) kaydırır. */
export function moveLink(links: readonly QuickLink[], id: string, dir: -1 | 1): QuickLink[] {
  const i = links.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= links.length) return [...links];
  const next = [...links];
  const a = next[i];
  const b = next[j];
  if (!a || !b) return next;
  next[i] = b;
  next[j] = a;
  return next;
}

export function sanitizeLinks(raw: unknown): LinksConfig {
  const list = obj(raw).links;
  if (!Array.isArray(list)) return { links: [] };
  const seen = new Set<string>();
  const links: QuickLink[] = [];
  for (const item of list) {
    if (links.length >= MAX_LINKS) break;
    const r = obj(item);
    const id = typeof r.id === 'string' ? r.id.slice(0, 40) : '';
    if (!id || seen.has(id) || typeof r.url !== 'string' || !/^https?:\/\//i.test(r.url)) continue;
    let url: string;
    try {
      const u = new URL(r.url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      url = u.href.slice(0, 2000);
    } catch {
      continue;
    }
    seen.add(id);
    links.push({ id, url, title: typeof r.title === 'string' ? r.title.trim().slice(0, 60) : '' });
  }
  return { links };
}
