import { ratesFromQuotes, convert as convertCurrency } from '../widgets/daily/converter';
import { normalizeText, rankItems, type PaletteItem } from '../palette/palette';
import type { ClipEntry } from '../clipboard/clipboard';
import type { Quote } from '../markets/types';

/** Hızlı pencerenin saf mantığı: hesap makinesi, birim/döviz çevirme, sıralama. Eval kullanılmaz. */

// ---------------------------------------------------------------------------
// Hesap makinesi (özyinelemeli iniş ayrıştırıcı)
// ---------------------------------------------------------------------------

const MAX_INPUT = 200;
const MAX_DEPTH = 40;

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private readonly src: string) {}

  parse(): number | null {
    const v = this.expr();
    this.skip();
    if (v === null || this.pos !== this.src.length || !Number.isFinite(v)) return null;
    return v;
  }

  private skip() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] ?? '')) this.pos++;
  }

  private peek(): string {
    this.skip();
    return this.src[this.pos] ?? '';
  }

  private expr(): number | null {
    let left = this.term();
    while (left !== null) {
      const op = this.peek();
      if (op !== '+' && op !== '-') break;
      this.pos++;
      const right = this.term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private term(): number | null {
    let left = this.power();
    while (left !== null) {
      const op = this.peek();
      if (op !== '*' && op !== '/' && op !== '%' && op !== '×' && op !== '÷') break;
      this.pos++;
      const right = this.power();
      if (right === null) return null;
      if (op === '/' || op === '÷') {
        if (right === 0) return null;
        left /= right;
      } else if (op === '%') {
        if (right === 0) return null;
        left %= right;
      } else {
        left *= right;
      }
    }
    return left;
  }

  private power(): number | null {
    const base = this.unary();
    if (base === null) return null;
    if (this.peek() === '^') {
      this.pos++;
      if (++this.depth > MAX_DEPTH) return null;
      const exp = this.power(); // sağdan bağlı
      this.depth--;
      if (exp === null) return null;
      const v = Math.pow(base, exp);
      return Number.isFinite(v) ? v : null;
    }
    return base;
  }

  private unary(): number | null {
    const c = this.peek();
    if (c === '-' || c === '+') {
      this.pos++;
      if (++this.depth > MAX_DEPTH) return null;
      const v = this.unary();
      this.depth--;
      return v === null ? null : c === '-' ? -v : v;
    }
    return this.primary();
  }

  private primary(): number | null {
    const c = this.peek();
    if (c === '(') {
      this.pos++;
      if (++this.depth > MAX_DEPTH) return null;
      const v = this.expr();
      this.depth--;
      if (v === null || this.peek() !== ')') return null;
      this.pos++;
      return v;
    }
    const rest = this.src.slice(this.pos);
    const num = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(rest);
    if (num) {
      this.pos += num[0].length;
      return Number(num[0].replace(',', '.'));
    }
    const word = /^[a-zA-Z]+/.exec(rest);
    if (word) {
      const w = word[0].toLowerCase();
      if (w === 'pi') {
        this.pos += 2;
        return Math.PI;
      }
      if (w === 'e') {
        this.pos += 1;
        return Math.E;
      }
    }
    return null;
  }
}

/** Aritmetik ifadeyi değerlendirir (+ - * / % ^ parantez, pi, e); geçersizse null. */
export function evalExpression(input: string): number | null {
  const s = input.trim();
  if (!s || s.length > MAX_INPUT) return null;
  return new Parser(s).parse();
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString('tr-TR', { useGrouping: false });
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6).replace('.', ',');
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 6, useGrouping: false });
}

// ---------------------------------------------------------------------------
// Birim çevirme
// ---------------------------------------------------------------------------

type Dim = 'length' | 'mass' | 'temp';
interface UnitDef {
  id: string;
  dim: Dim;
  /** Boyutun taban birimine çarpan (sıcaklıkta kullanılmaz). */
  factor: number;
  label: string;
}

const UNIT_LIST: UnitDef[] = [
  { id: 'km', dim: 'length', factor: 1000, label: 'km' },
  { id: 'mi', dim: 'length', factor: 1609.344, label: 'mil' },
  { id: 'm', dim: 'length', factor: 1, label: 'm' },
  { id: 'cm', dim: 'length', factor: 0.01, label: 'cm' },
  { id: 'inch', dim: 'length', factor: 0.0254, label: 'inç' },
  { id: 'ft', dim: 'length', factor: 0.3048, label: 'ft' },
  { id: 'kg', dim: 'mass', factor: 1, label: 'kg' },
  { id: 'lb', dim: 'mass', factor: 0.45359237, label: 'lb' },
  { id: 'g', dim: 'mass', factor: 0.001, label: 'g' },
  { id: 'c', dim: 'temp', factor: 1, label: '°C' },
  { id: 'f', dim: 'temp', factor: 1, label: '°F' },
];

const UNIT_ALIAS: Record<string, string> = {
  km: 'km', kilometre: 'km', kilometer: 'km',
  mi: 'mi', mil: 'mi', mile: 'mi', miles: 'mi',
  m: 'm', metre: 'm', meter: 'm',
  cm: 'cm', santim: 'cm',
  inch: 'inch', inc: 'inch', in: 'inch', 'inç': 'inch',
  ft: 'ft', foot: 'ft', feet: 'ft',
  kg: 'kg', kilo: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', libre: 'lb',
  g: 'g', gr: 'g', gram: 'g',
  c: 'c', '°c': 'c', celsius: 'c', santigrat: 'c',
  f: 'f', '°f': 'f', fahrenheit: 'f',
};

const DEFAULT_TARGET: Record<string, string> = {
  km: 'mi', mi: 'km', m: 'ft', ft: 'm', cm: 'inch', inch: 'cm', kg: 'lb', lb: 'kg', g: 'kg', c: 'f', f: 'c',
};

const SEPARATORS = new Set(['to', 'in', '->', '=>', '→', '=', '>', 'ye', 'ya']);

function unitOf(token: string): UnitDef | null {
  const id = UNIT_ALIAS[token];
  return id ? (UNIT_LIST.find((u) => u.id === id) ?? null) : null;
}

export function convertUnit(value: number, from: string, to: string): number | null {
  const a = UNIT_LIST.find((u) => u.id === from);
  const b = UNIT_LIST.find((u) => u.id === to);
  if (!a || !b || a.dim !== b.dim) return null;
  if (a.dim === 'temp') {
    const celsius = from === 'f' ? ((value - 32) * 5) / 9 : value;
    return to === 'f' ? (celsius * 9) / 5 + 32 : celsius;
  }
  return (value * a.factor) / b.factor;
}

/** "tutar birim [to] [birim]" biçimini ayrıştırır. */
function splitQuantity(input: string): { amount: number; units: string[] } | null {
  const m = /^(-?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(input.trim().toLowerCase());
  if (!m) return null;
  const amount = Number((m[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  const tokens = (m[2] ?? '').split(/\s+/).filter(Boolean);
  let units: string[];
  if (tokens.length === 3 && SEPARATORS.has(tokens[1] ?? '')) units = [tokens[0] ?? '', tokens[2] ?? ''];
  else if (tokens.length === 2 || tokens.length === 1) units = tokens;
  else return null;
  return units.length > 0 ? { amount, units } : null;
}

// ---------------------------------------------------------------------------
// Yanıt: hesap / birim / döviz
// ---------------------------------------------------------------------------

export interface QuickAnswer {
  kind: 'calc' | 'unit' | 'currency';
  /** Büyük gösterilen sonuç. */
  text: string;
  /** Ek açıklama (ör. "100 USD"). */
  detail: string;
  /** Enter ile panoya kopyalanacak metin. */
  copy: string;
}

function currencyAnswer(amount: number, units: string[], rates: ReadonlyMap<string, number>): QuickAnswer | null {
  const from = (units[0] ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(from) || !rates.has(from)) return null;
  let to = (units[1] ?? '').toUpperCase();
  if (!to) to = from === 'TRY' ? 'USD' : 'TRY';
  if (!/^[A-Z]{3}$/.test(to) || !rates.has(to)) return null;
  const out = convertCurrency(amount, from, to, rates);
  if (out === null) return null;
  const text = out.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return {
    kind: 'currency',
    text: `${text} ${to}`,
    detail: `${formatNumber(amount)} ${from} (TCMB referans kuru)`,
    copy: text,
  };
}

/**
 * Hızlı pencere girdisini yanıtlar. `=` önekli → hesap makinesi; "5 km", "30 c to f", "100 usd",
 * "50 eur try" → çevirme. `rates`: TCMB referans tablosu (yoksa boş).
 */
export function answerQuery(input: string, rates: ReadonlyMap<string, number> = new Map()): QuickAnswer | null {
  const raw = input.trim();
  if (raw.startsWith('=')) {
    const v = evalExpression(raw.slice(1));
    if (v === null) return null;
    const text = formatNumber(v);
    return { kind: 'calc', text, detail: raw.slice(1).trim(), copy: text };
  }
  const q = splitQuantity(raw);
  if (!q) return null;
  const first = unitOf(q.units[0] ?? '');
  if (first) {
    const second = q.units[1] !== undefined ? unitOf(q.units[1]) : unitOf(DEFAULT_TARGET[first.id] ?? '');
    if (!second) return null;
    const out = convertUnit(q.amount, first.id, second.id);
    if (out === null) return null;
    const text = formatNumber(Math.round(out * 1e6) / 1e6);
    return {
      kind: 'unit',
      text: `${text} ${second.label}`,
      detail: `${formatNumber(q.amount)} ${first.label}`,
      copy: text,
    };
  }
  return currencyAnswer(q.amount, q.units, rates);
}

/** Önbellekteki piyasa verisinden (yalnız TCMB referans) kur tablosu. */
export function ratesFromReference(quotes: readonly Quote[] | null | undefined): Map<string, number> {
  return ratesFromQuotes(quotes ?? []);
}

// ---------------------------------------------------------------------------
// Arama sıralaması
// ---------------------------------------------------------------------------

export type QuickKind = 'panel' | 'app' | 'note' | 'action';

export interface QuickEntry {
  id: string;
  kind: QuickKind;
  title: string;
  subtitle?: string;
  keywords?: string;
  /** Eylem için taşınan kimlik (panel/uygulama/not kimliği veya eylem adı). */
  ref: string;
}

/** `rankItems` ile aynı puanlama; boş sorguda ilk `limit` kayıt. */
export function rankQuick(entries: readonly QuickEntry[], query: string, limit = 8): QuickEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const items: PaletteItem[] = entries.map((e) => ({
    id: e.id,
    group: 'app',
    title: e.title,
    subtitle: e.subtitle,
    keywords: e.keywords,
    run: () => {},
  }));
  return rankItems(items, query, limit)
    .map((i) => byId.get(i.id))
    .filter((e): e is QuickEntry => e !== undefined);
}

/** Pano modu: en yeni `limit` kayıt (isteğe bağlı sözcük süzgeci). */
export function recentClips(entries: readonly ClipEntry[], query = '', limit = 10): ClipEntry[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  return [...entries]
    .filter((e) => words.every((w) => normalizeText(e.text).includes(w)))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
