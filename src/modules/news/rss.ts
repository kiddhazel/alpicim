import { XMLParser } from 'fast-xml-parser';
import type { Feed, NewsItem } from './types';

/** Bir akıştan alınacak en fazla öğe sayısı. */
export const MAX_ITEMS_PER_FEED = 60;
const SUMMARY_LIMIT = 260;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: true,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => name === 'item' || name === 'entry',
});

type Node = Record<string, unknown>;

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

/** RSS 2.0, RSS 1.0 (RDF) ve Atom akışlarını ortak NewsItem listesine çevirir. */
export function parseFeed(xml: string, feed: Pick<Feed, 'id' | 'name' | 'category'>): NewsItem[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new FeedParseError(err instanceof Error ? err.message : 'XML okunamadı');
  }

  const rss = asNode(doc.rss);
  const rdf = asNode(doc.RDF);
  const atom = asNode(doc.feed);

  let rawItems: Node[] = [];
  let channelTitle = '';
  if (rss) {
    const channel = asNode(rss.channel);
    channelTitle = text(channel?.title);
    rawItems = asArray(channel?.item);
  } else if (rdf) {
    channelTitle = text(asNode(rdf.channel)?.title);
    rawItems = asArray(rdf.item);
  } else if (atom) {
    channelTitle = text(atom.title);
    rawItems = asArray(atom.entry);
  } else {
    throw new FeedParseError('RSS/Atom akışı değil');
  }

  const fallbackSource = channelTitle || feed.name;
  const items: NewsItem[] = [];
  for (const raw of rawItems.slice(0, MAX_ITEMS_PER_FEED)) {
    const link = pickLink(raw);
    const rawTitle = cleanText(text(raw.title));
    if (!link || !rawTitle) continue;

    const source = cleanText(text(raw.source)) || fallbackSource;
    const title = stripSourceSuffix(rawTitle, source);
    const summaryRaw = text(raw.description) || text(raw.summary) || text(raw.content);
    const summary = makeSummary(summaryRaw, title, source);
    const date = text(raw.pubDate) || text(raw.published) || text(raw.updated) || text(raw.date);

    items.push({
      id: stableId(link),
      title,
      link,
      source,
      publishedAt: parseDate(date),
      summary,
      category: feed.category,
      feedId: feed.id,
    });
  }
  return items;
}

function asNode(value: unknown): Node | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Node) : undefined;
}

function asArray(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter((v): v is Node => !!asNode(v));
  const node = asNode(value);
  return node ? [node] : [];
}

/** Düğümün metin içeriği (öznitelikli düğümlerde #text). */
function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  const node = asNode(value);
  if (node && '#text' in node) return text(node['#text']);
  return '';
}

function pickLink(raw: Node): string {
  const link = raw.link;
  // Atom: <link href="..." rel="alternate"/> (bir veya birden çok)
  const candidates = Array.isArray(link) ? link : [link];
  for (const c of candidates) {
    const node = asNode(c);
    if (node && typeof node['@_href'] === 'string') {
      const rel = node['@_rel'];
      if (rel === undefined || rel === 'alternate') return node['@_href'].trim();
    }
  }
  const plain = text(link).trim();
  if (plain) return plain;
  const guid = asNode(raw.guid);
  if (guid && guid['@_isPermaLink'] !== 'false') {
    const g = text(guid).trim();
    if (/^https?:\/\//.test(g)) return g;
  }
  return '';
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML etiketlerini kaldırır, varlıkları çözer, boşlukları sadeleştirir. */
export function cleanText(value: string): string {
  return decodeEntities(
    value
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Google News başlıkları "Başlık - Kaynak" biçimindedir; kaynak ayrıca gösterildiği için kesilir. */
export function stripSourceSuffix(title: string, source: string): string {
  if (!source) return title;
  for (const sep of [' - ', ' – ', ' | ']) {
    const suffix = `${sep}${source}`;
    if (title.endsWith(suffix) && title.length > suffix.length + 5) {
      return title.slice(0, -suffix.length).trim();
    }
  }
  return title;
}

function makeSummary(raw: string, title: string, source: string): string {
  const cleaned = cleanText(raw);
  if (!cleaned) return '';
  // Google News açıklaması yalnızca başlık + kaynak tekrarıdır; anlamsızsa gösterme.
  const normalized = cleaned.replace(source, '').trim();
  if (normalized.startsWith(title.slice(0, 40)) && normalized.length < title.length + 40) return '';
  if (cleaned.length <= SUMMARY_LIMIT) return cleaned;
  const cut = cleaned.slice(0, SUMMARY_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : SUMMARY_LIMIT).trim()}…`;
}

export function parseDate(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : null;
}

/** FNV-1a 32 bit — bağlantıdan kısa ve kararlı kimlik. */
export function stableId(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `n${(hash >>> 0).toString(36)}${input.length.toString(36)}`;
}
