import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDGETS } from '../../modules/widgets/registry';
import { WIDGET_TYPES } from '../../modules/workspaces/workspaces';
import { MODULES } from './index';
import { panelsOf, settingsOf } from './registry';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const sources = sourceFiles('src').map((f) => readFileSync(f, 'utf8'));

describe('bağlantı bütünlüğü', () => {
  it('her widget türünün kayıtlı bir tanımı var', () => {
    const defined = WIDGETS.map((w) => w.type);
    expect([...defined].sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('windows.rs PANELS içindeki her panel bir modülde kayıtlı', () => {
    const rust = readFileSync('src-tauri/src/windows.rs', 'utf8');
    const start = rust.indexOf('const PANELS');
    const block = rust.slice(start, rust.indexOf('];', start));
    const rustIds = [...block.matchAll(/\("([a-z0-9-]+)",/g)].map((m) => m[1]);
    const ids = panelsOf(MODULES).map((p) => p.id as string);
    for (const id of rustIds) expect(ids).toContain(id);
  });

  it('ayar bölümleri ve paneller yüklenebilir bileşen sağlar', () => {
    for (const p of panelsOf(MODULES)) expect(typeof p.load).toBe('function');
    for (const s of settingsOf(MODULES)) expect(typeof s.section.load).toBe('function');
  });

  it('TS tarafından çağrılan her Rust komutu lib.rs generate_handler içinde kayıtlı', () => {
    const lib = readFileSync('src-tauri/src/lib.rs', 'utf8');
    const handler = lib.slice(lib.indexOf('generate_handler'));
    const registered = new Set([...handler.matchAll(/\b([a-z][a-z0-9_]*)\s*,/g)].map((m) => m[1]));
    const called = new Set<string>();
    for (const src of sources) {
      for (const m of src.matchAll(/\b(?:call|invoke)(?:<[^>]*>)?\(\s*'([a-z][a-z0-9_]*)'/g)) called.add(m[1] as string);
    }
    expect(called.size).toBeGreaterThan(50);
    const missing = [...called].filter((c) => !registered.has(c));
    expect(missing).toEqual([]);
  });

  it('dinlenen window olaylarının gönderen tarafı var', () => {
    const all = sources.join('\n');
    const consts = [...all.matchAll(/export const ([A-Z_]+_EVENT) = '(alpicim:[a-z-]+)'/g)];
    for (const [, name, value] of consts) {
      const listened = new RegExp(String.raw`addEventListener\(\s*(?:${name}|'${value}')`).test(all);
      const sent = new RegExp(String.raw`dispatchEvent\(\s*new (?:Custom)?Event(?:<[^>]*>)?\(\s*(?:${name}|'${value}')`).test(all);
      if (listened) expect(sent, `${name} dinleniyor ama gönderilmiyor`).toBe(true);
    }
  });
});

describe('dinamik çeviri anahtarları', () => {
  it('rozet, oda eşyası ve ruh hâli metinleri tr.ts içinde var', async () => {
    const { t } = await import('../../i18n');
    const { BADGES } = await import('../../modules/achievements/achievements');
    const { FURNITURE } = await import('../../modules/room/room');
    const { MOOD_IDS } = await import('../../modules/widgets/fun/mood');
    const keys = [
      ...BADGES.flatMap((b) => [`achievements.items.${b.id}.title`, `achievements.items.${b.id}.hint`]),
      ...FURNITURE.map((f) => `room.items.${f.id}`),
      ...MOOD_IDS.map((m) => `widgets.mood.moods.${m}`),
      'feeds.invalidProtocol',
      'feeds.invalidUrl',
    ];
    for (const k of keys) expect(t(k as Parameters<typeof t>[0]), k).not.toBe(k);
  });
});
