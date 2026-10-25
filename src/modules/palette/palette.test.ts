import { describe, expect, it } from 'vitest';
import { normalizeText, rankItems, type PaletteItem } from './palette';

const item = (id: string, title: string, extra: Partial<PaletteItem> = {}): PaletteItem => ({
  id,
  group: 'panel',
  title,
  run: () => {},
  ...extra,
});

describe('komut paleti', () => {
  it('Türkçe karakterleri normalleştirir', () => {
    expect(normalizeText('  IŞIK Çalışma ')).toBe('isik calisma');
  });

  it('başlık başlangıcını öne alır, eşleşmeyenleri atar', () => {
    const items = [item('a', 'Haberler'), item('b', 'Tam ekran aç'), item('c', 'Ekranı taşı'), item('d', 'Müzik')];
    expect(rankItems(items, 'ekran').map((i) => i.id)).toEqual(['c', 'b']);
    expect(rankItems(items, 'xyz')).toEqual([]);
  });

  it('tüm sözcükler eşleşmeli; ek anahtar sözcükler de aranır', () => {
    const items = [item('a', 'Discord', { subtitle: 'Uygulama' }), item('b', 'Spotify', { keywords: 'müzik uygulama' })];
    expect(rankItems(items, 'muzik').map((i) => i.id)).toEqual(['b']);
    expect(rankItems(items, 'uygulama dis').map((i) => i.id)).toEqual(['a']);
  });

  it('boş sorguda sırayı korur ve sınırlar', () => {
    const items = Array.from({ length: 50 }, (_, i) => item(String(i), `Öğe ${i}`));
    expect(rankItems(items, '', 5).map((i) => i.id)).toEqual(['0', '1', '2', '3', '4']);
  });
});
