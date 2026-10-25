import { describe, expect, it } from 'vitest';
import { demoQuotes } from './adapters/demo';
import { parseSeries } from './adapters/frankfurter';
import { toNumber } from './adapters/provider';
import { archiveUrl, bulletinTime, parseTcmbXml } from './adapters/tcmb';
import { mapQuote, takeToken } from './adapters/twelvedata';
import { deriveGramGold, sanitizeConfig, watchKey } from './marketService';
import type { Quote } from './types';

const TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="23.10.2026" Date="10/23/2026" Bulten_No="2026/201">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><Isim>ABD DOLARI</Isim><CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>49.5647</ForexBuying><ForexSelling>49.6540</ForexSelling>
    <BanknoteBuying>49.5300</BanknoteBuying><BanknoteSelling>49.7285</BanknoteSelling>
    <CrossRateUSD/><CrossRateOther/>
  </Currency>
  <Currency CrossOrder="10" Kod="JPY" CurrencyCode="JPY">
    <Unit>100</Unit><Isim>JAPON YENİ</Isim><CurrencyName>JAPENESE YEN</CurrencyName>
    <ForexBuying>32.1000</ForexBuying><ForexSelling>32.3000</ForexSelling>
    <BanknoteBuying/><BanknoteSelling/>
    <CrossRateUSD>154.2</CrossRateUSD><CrossRateOther/>
  </Currency>
</Tarih_Date>`;

describe('TCMB', () => {
  it('bülteni ayrıştırır, birim ve boş alanları doğru işler', () => {
    const b = parseTcmbXml(TCMB_XML);
    expect(b.date).toBe('23.10.2026');
    expect(b.rates.get('USD')?.forexSelling).toBe(49.654);
    expect(b.rates.get('JPY')?.unit).toBe(100);
    expect(b.rates.get('JPY')?.banknoteSelling).toBeNull();
  });

  it('bülten zamanını 15:30 TSİ olarak hesaplar', () => {
    expect(bulletinTime('23.10.2026')).toBe(Date.UTC(2026, 9, 23, 12, 30));
    expect(bulletinTime('bozuk')).toBeNull();
  });

  it('arşiv adresini doğru biçimde üretir', () => {
    expect(archiveUrl(new Date(Date.UTC(2026, 9, 22)))).toBe('https://www.tcmb.gov.tr/kurlar/202610/22102026.xml');
  });
});

describe('Frankfurter', () => {
  it('seriyi tarih sırasıyla döndürür ve eksik değerleri atar', () => {
    const json = JSON.stringify({
      amount: 1,
      base: 'USD',
      rates: { '2026-10-22': { TRY: 49.6 }, '2026-10-21': { TRY: 49.5 }, '2026-10-20': { EUR: 0.9 } },
    });
    expect(parseSeries(json, 'TRY')).toEqual([
      { t: '2026-10-21', v: 49.5 },
      { t: '2026-10-22', v: 49.6 },
    ]);
  });
});

describe('Twelve Data', () => {
  it('quote yanıtını piyasa verisi olarak eşler', () => {
    const q = mapQuote(
      {
        symbol: 'XAU/USD',
        name: 'Gold Spot',
        currency: 'US Dollar',
        timestamp: 1_790_000_000,
        close: '2400.5',
        change: '-10.5',
        percent_change: '-0.43',
        is_market_open: false,
      },
      { symbol: 'XAU/USD', providerId: 'twelvedata' },
      1,
    );
    expect(q.kind).toBe('market');
    expect(q.price).toBe(2400.5);
    expect(q.changePct).toBe(-0.43);
    expect(q.asOf).toBe(1_790_000_000_000);
    expect(q.note).toMatch(/kapalı/);
  });

  it('istemci tarafı sınırlayıcı dakikada 8 isteği aşmaz', () => {
    const t0 = 10_000_000;
    let allowed = 0;
    for (let i = 0; i < 12; i++) if (takeToken(t0 + i)) allowed++;
    expect(allowed).toBe(8);
    expect(takeToken(t0 + 61_000)).toBe(true);
  });
});

describe('hesaplamalar ve yapılandırma', () => {
  const base = { change: null, changePct: null, providerId: 'x', sourceName: 'x', asOf: null, fetchedAt: 0, kind: 'market' as const };
  it('gram altını hesaplar ve "hesaplanmış" olarak işaretler', () => {
    const ounce: Quote = { ...base, key: 'o', symbol: 'XAU/USD', label: 'o', price: 3110.34768, currency: 'USD', change: 10 };
    const usd: Quote = { ...base, key: 'u', symbol: 'USD/TRY', label: 'u', price: 40, currency: 'TRY', change: 0 };
    const gram = deriveGramGold(ounce, usd);
    expect(gram.kind).toBe('derived');
    expect(gram.price).toBeCloseTo(4000, 6);
    expect(gram.change).toBeCloseTo((10 * 40) / 31.1034768, 6);
  });

  it('bozuk yapılandırmayı güvenli biçime getirir', () => {
    const cfg = sanitizeConfig({ currencies: ['USD', 'usd', 'EUR', 'USD', 5], watchlist: [{ symbol: 'AAPL', providerId: 'twelvedata' }, { foo: 1 }] });
    expect(cfg.currencies).toEqual(['USD', 'EUR']);
    expect(cfg.watchlist).toHaveLength(1);
    expect(watchKey({ symbol: 'THYAO', exchange: 'XIST', providerId: 'twelvedata' })).toBe('twelvedata:THYAO@XIST');
  });

  it('toNumber boş metni sayı saymaz', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('1.5')).toBe(1.5);
    expect(toNumber('abc')).toBeNull();
  });

  it('DEMO verisi her zaman demo olarak etiketlenir', () => {
    for (const { quote } of demoQuotes()) expect(quote.kind).toBe('demo');
  });
});
