import { describe, expect, it } from 'vitest';
import { cleanText, FeedParseError, parseDate, parseFeed, stableId, stripSourceSuffix } from './rss';

const feed = { id: 'f1', name: 'Test Akışı', category: 'teknoloji' as const };

const GOOGLE_NEWS_RSS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Teknoloji - Google Haberler</title>
    <item>
      <title>Yeni işlemci tanıtıldı - Örnek Haber</title>
      <link>https://news.google.com/rss/articles/ABC?oc=5</link>
      <guid isPermaLink="false">ABC</guid>
      <pubDate>Fri, 23 Oct 2026 08:15:00 GMT</pubDate>
      <description>&lt;a href="https://news.google.com/rss/articles/ABC"&gt;Yeni işlemci tanıtıldı&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Örnek Haber&lt;/font&gt;</description>
      <source url="https://ornekhaber.com">Örnek Haber</source>
    </item>
    <item>
      <title>Bağlantısız öğe</title>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Bilim Blogu</title>
  <entry>
    <title>Kara delik gözlemi</title>
    <link rel="alternate" href="https://bilim.example/kara-delik"/>
    <link rel="self" href="https://bilim.example/feed/1"/>
    <updated>2026-10-20T10:00:00Z</updated>
    <summary type="html">&lt;p&gt;Gökbilimciler &lt;b&gt;yeni&lt;/b&gt; bir gözlem yaptı.&lt;/p&gt;</summary>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>RDF Kaynağı</title></channel>
  <item>
    <title>RDF haberi</title>
    <link>https://rdf.example/1</link>
    <dc:date>2026-10-21T09:00:00+03:00</dc:date>
  </item>
</rdf:RDF>`;

describe('parseFeed', () => {
  it('Google News RSS: başlıktan kaynak ekini ayırır, anlamsız açıklamayı atar', () => {
    const items = parseFeed(GOOGLE_NEWS_RSS, feed);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.title).toBe('Yeni işlemci tanıtıldı');
    expect(item?.source).toBe('Örnek Haber');
    expect(item?.link).toBe('https://news.google.com/rss/articles/ABC?oc=5');
    expect(item?.summary).toBe('');
    expect(item?.publishedAt).toBe(Date.UTC(2026, 9, 23, 8, 15));
    expect(item?.category).toBe('teknoloji');
  });

  it('Atom: alternate bağlantıyı seçer ve HTML özeti temizler', () => {
    const [item] = parseFeed(ATOM, feed);
    expect(item?.link).toBe('https://bilim.example/kara-delik');
    expect(item?.source).toBe('Bilim Blogu');
    expect(item?.summary).toBe('Gökbilimciler yeni bir gözlem yaptı.');
  });

  it('RSS 1.0 (RDF) ve dc:date destekler', () => {
    const [item] = parseFeed(RDF, feed);
    expect(item?.title).toBe('RDF haberi');
    expect(item?.publishedAt).toBe(Date.parse('2026-10-21T06:00:00Z'));
  });

  it('akış olmayan içerikte anlamlı hata verir', () => {
    expect(() => parseFeed('<html><body>Merhaba</body></html>', feed)).toThrow(FeedParseError);
  });
});

describe('yardımcılar', () => {
  it('cleanText etiketleri ve varlıkları temizler', () => {
    expect(cleanText('<p>A&amp;B&nbsp;&#304;stanbul &#x15F;</p><script>x()</script>')).toBe('A&B İstanbul ş');
  });

  it('stripSourceSuffix yalnızca gerçek kaynak ekini keser', () => {
    expect(stripSourceSuffix('Maç sonucu belli oldu - Spor Sitesi', 'Spor Sitesi')).toBe('Maç sonucu belli oldu');
    expect(stripSourceSuffix('A - B', 'B')).toBe('A - B');
    expect(stripSourceSuffix('Başlık', '')).toBe('Başlık');
  });

  it('parseDate geçersiz tarihte null döner', () => {
    expect(parseDate('dün')).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('stableId kararlıdır ve bağlantıya göre değişir', () => {
    expect(stableId('https://a.example/1')).toBe(stableId('https://a.example/1'));
    expect(stableId('https://a.example/1')).not.toBe(stableId('https://a.example/2'));
  });
});
