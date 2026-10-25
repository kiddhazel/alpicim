import { tr, type Messages } from './tr';

/** "news.category.spor" gibi tüm yaprak anahtarların birleşimi (derleme zamanında denetlenir). */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

const dictionaries: Record<string, Messages> = { tr };
let active: Messages = tr;

export function setLanguage(lang: string) {
  active = dictionaries[lang] ?? tr;
}

function lookup(key: string): string | undefined {
  let node: unknown = active;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Çeviri: bulunamazsa anahtarın kendisi döner (eksik metin hemen fark edilir). */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = lookup(key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
