/**
 * Küçük, güvenli Markdown ayrıştırıcı. Çıktı yalnızca veri ağacıdır (HTML üretilmez);
 * React öğeleri MarkdownView'da oluşturulur, böylece ham metin hiçbir zaman HTML olarak yorumlanmaz.
 *
 * Desteklenen: # / ## / ### başlık, **kalın**, *italik* / _italik_, `kod`, ``` kod bloğu ```, - / * / 1. listeler,
 * - [ ] görev kutuları, > alıntı, --- ayırıcı, [metin](https://…) ve çıplak http(s) bağlantıları.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export interface ListItem {
  content: Inline[];
  /** null: görev değil; true/false: görev kutusu durumu. */
  task: boolean | null;
  /** Kaynak metindeki satır numarası (0 tabanlı) — görev kutusunu değiştirmek için. */
  line: number;
  /** Girinti düzeyi (0, 1, 2…). */
  depth: number;
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'quote'; lines: Inline[][] }
  | { type: 'code'; text: string }
  | { type: 'hr' };

/** Yalnızca http/https bağlantılarına izin verir ("www." ile başlayana https eklenir). */
export function safeHref(raw: string): string | null {
  const s = raw.trim();
  const candidate = /^www\./i.test(s) ? `https://${s}` : s;
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const MAX_DEPTH = 4;
const LINK_RE = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
const BARE_URL_RE = /^(?:https?:\/\/|www\.)[^\s<>()]+/i;

function isWordChar(c: string | undefined): boolean {
  return !!c && /[\p{L}\p{N}]/u.test(c);
}

/** Satır içi biçimleri ayrıştırır. */
export function parseInline(text: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    const rest = text.slice(i);

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (depth < MAX_DEPTH && rest.startsWith('**')) {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'bold', children: parseInline(text.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }

    if (depth < MAX_DEPTH && (ch === '*' || ch === '_') && !isWordChar(text[i - 1]) && text[i + 1] !== ' ' && text[i + 1] !== ch) {
      let end = text.indexOf(ch, i + 1);
      // "_" kelime içindeyse (snake_case) kapanış sayılmaz.
      while (end !== -1 && ch === '_' && isWordChar(text[end + 1])) end = text.indexOf(ch, end + 1);
      if (end > i + 1 && text[end - 1] !== ' ') {
        flush();
        out.push({ type: 'italic', children: parseInline(text.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '[') {
      const m = LINK_RE.exec(rest);
      if (m) {
        const href = safeHref(m[2] as string);
        flush();
        out.push(href ? { type: 'link', text: m[1] as string, href } : { type: 'text', text: m[0] });
        i += m[0].length;
        continue;
      }
    }

    if ((ch === 'h' || ch === 'H' || ch === 'w' || ch === 'W') && !isWordChar(text[i - 1])) {
      const m = BARE_URL_RE.exec(rest);
      if (m) {
        // Cümle sonundaki noktalama bağlantıya dahil edilmez.
        const raw = m[0].replace(/[.,;:!?'"]+$/, '');
        const href = safeHref(raw);
        if (href) {
          flush();
          out.push({ type: 'link', text: raw, href });
          i += raw.length;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const TASK_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s?(.*)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d{1,6})[.)]\s+(.*)$/;
const HR_RE = /^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const FENCE_RE = /^\s*```/;

function depthOf(indent: string): number {
  const width = indent.replace(/\t/g, '  ').length;
  return Math.min(4, Math.floor(width / 2));
}

/** Metni blok listesine çevirir. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;
  let quote: Inline[][] | null = null;
  let list: Extract<Block, { type: 'list' }> | null = null;

  const close = () => {
    if (para) blocks.push({ type: 'paragraph', lines: para });
    if (quote) blocks.push({ type: 'quote', lines: quote });
    if (list) blocks.push(list);
    para = null;
    quote = null;
    list = null;
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n] as string;

    if (FENCE_RE.test(line)) {
      close();
      const body: string[] = [];
      n++;
      while (n < lines.length && !FENCE_RE.test(lines[n] as string)) {
        body.push(lines[n] as string);
        n++;
      }
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      close();
      continue;
    }

    if (HR_RE.test(line)) {
      close();
      blocks.push({ type: 'hr' });
      continue;
    }

    const h = HEADING_RE.exec(line);
    if (h) {
      close();
      blocks.push({ type: 'heading', level: (h[1] as string).length as 1 | 2 | 3, content: parseInline((h[2] as string).trim()) });
      continue;
    }

    const task = TASK_RE.exec(line);
    const ordered = task ? null : ORDERED_RE.exec(line);
    const bullet = task || ordered ? null : BULLET_RE.exec(line);
    if (task || ordered || bullet) {
      const isOrdered = !!ordered;
      if (para || quote || (list && (list as { ordered: boolean }).ordered !== isOrdered)) close();
      if (!list) list = { type: 'list', ordered: isOrdered, start: ordered ? Number(ordered[2]) : 1, items: [] };
      const item: ListItem = task
        ? { content: parseInline(task[3] as string), task: task[2] !== ' ', line: n, depth: depthOf(task[1] as string) }
        : ordered
          ? { content: parseInline(ordered[3] as string), task: null, line: n, depth: depthOf(ordered[1] as string) }
          : { content: parseInline((bullet as RegExpExecArray)[2] as string), task: null, line: n, depth: depthOf((bullet as RegExpExecArray)[1] as string) };
      (list as Extract<Block, { type: 'list' }>).items.push(item);
      continue;
    }

    const q = QUOTE_RE.exec(line);
    if (q) {
      if (para || list) close();
      quote ??= [];
      quote.push(parseInline(q[1] as string));
      continue;
    }

    if (quote || list) close();
    para ??= [];
    para.push(parseInline(line.trim()));
  }
  close();
  return blocks;
}
