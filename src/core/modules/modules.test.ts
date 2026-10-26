import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { WIDGET_TYPES } from '../../modules/workspaces/workspaces';
import { MODULES } from './index';
import {
  commandsOf,
  defaultModuleStates,
  enabledIds,
  enabledModules,
  groupByCategory,
  isModuleEnabled,
  moduleOfPanel,
  moduleOfWidget,
  panelsOf,
  sanitizeModuleStates,
  servicesOf,
  settingsOf,
  widgetTypesOf,
  MODULE_ID_PATTERN,
} from './registry';
import type { ModuleManifest, PaletteContext } from './types';

const ctx = {
  openPanel: () => {},
  settings: { lailaEnabled: true, lailaDesktop: false },
  toast: { push: () => {} },
  focus: { on: false, toggle: () => {} },
} as unknown as PaletteContext;

const all = defaultModuleStates(MODULES);

describe('modül kaydı', () => {
  it('kimlikler benzersiz ve [a-z0-9-]', () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(MODULE_ID_PATTERN);
  });

  it('Ana ekran ve Ayarlar zorunlu, çekirdek kategoride', () => {
    const required = MODULES.filter((m) => m.required).map((m) => m.id);
    expect(required.sort()).toEqual(['home', 'settings']);
    for (const m of MODULES.filter((x) => x.required)) expect(m.category).toBe('core');
  });

  it('eğlence modülleri (§7) fun kategorisinde', () => {
    for (const id of ['laila', 'games', 'room', 'achievements', 'fortune', 'mood', 'proverb', 'watchlist']) {
      expect(MODULES.find((m) => m.id === id)?.category).toBe('fun');
    }
  });

  it('her modülün adı ve açıklaması tr.ts içinde var', () => {
    for (const m of MODULES) {
      expect(t(m.titleKey)).not.toBe(m.titleKey);
      expect(t(m.descriptionKey)).not.toBe(m.descriptionKey);
    }
  });

  it('panel kimlikleri benzersiz ve windows.rs PANELS içinde kayıtlı', () => {
    const ids = panelsOf(MODULES).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rust = readFileSync('src-tauri/src/windows.rs', 'utf8');
    const block = rust.slice(rust.indexOf('const PANELS'), rust.indexOf('];', rust.indexOf('const PANELS')));
    const rustIds = [...block.matchAll(/\("([a-z0-9-]+)",/g)].map((m) => m[1]);
    for (const id of ids) expect(rustIds).toContain(id);
  });

  it('her widget türü tam bir modüle ait', () => {
    const types = widgetTypesOf(MODULES);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('ayar bölümü kimlikleri benzersiz ve çekirdek bölümlerle çakışmaz', () => {
    const core = ['appearance', 'updates', 'display', 'bar', 'workspaces', 'shortcuts', 'features', 'windows', 'providers', 'modules', 'about'];
    const ids = settingsOf(MODULES).map((s) => s.section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(core).not.toContain(id);
  });
});

describe('sanitizeModuleStates', () => {
  it('geçersiz girdide varsayılanları döndürür', () => {
    expect(sanitizeModuleStates(null, MODULES)).toEqual(all);
    expect(sanitizeModuleStates('x', MODULES)).toEqual(all);
    expect(sanitizeModuleStates([], MODULES)).toEqual(all);
  });

  it('bilinmeyen kimlikleri atar, boolean olmayanları varsayılana düşürür', () => {
    const out = sanitizeModuleStates({ news: false, laila: 'no', ghost: true }, MODULES);
    expect(out.news).toBe(false);
    expect(out.laila).toBe(true);
    expect('ghost' in out).toBe(false);
  });

  it('zorunlu modülleri her zaman açık tutar', () => {
    const out = sanitizeModuleStates({ home: false, settings: false }, MODULES);
    expect(out.home).toBe(true);
    expect(out.settings).toBe(true);
  });

  it('varsayılan olarak tüm modüller açık', () => {
    expect(Object.values(all).every(Boolean)).toBe(true);
  });
});

describe('türetme', () => {
  const off = (...ids: string[]) => sanitizeModuleStates(Object.fromEntries(ids.map((i) => [i, false])), MODULES);

  it('hepsi açıkken tüm panel ve widgetlar görünür', () => {
    const on = enabledModules(MODULES, all);
    expect(panelsOf(on)).toHaveLength(panelsOf(MODULES).length);
    expect(widgetTypesOf(on)).toHaveLength(WIDGET_TYPES.length);
  });

  it('kapalı modülün paneli, widgetı, servisi ve komutu kalkar', () => {
    const states = off('news', 'laila', 'notes', 'screenshot', 'focus');
    const on = enabledModules(MODULES, states);
    expect(panelsOf(on).some((p) => p.id === 'news')).toBe(false);
    expect(panelsOf(on).some((p) => p.id === 'home')).toBe(true);
    expect(widgetTypesOf(on)).not.toContain('news');
    expect(widgetTypesOf(on)).not.toContain('quicknote');
    expect(servicesOf(on, 'shell-overlay')).toHaveLength(0);
    expect(servicesOf(MODULES, 'shell-overlay').map((s) => s.service.id)).toEqual(['laila']);
    const ids = commandsOf(on, ctx).map((c) => c.id);
    expect(ids).not.toContain('act:newnote');
    expect(ids).not.toContain('act:laila-chat');
    expect(ids).not.toContain('act:focus');
    expect(commandsOf(MODULES, ctx).map((c) => c.id)).toEqual(expect.arrayContaining(['act:newnote', 'act:laila-chat', 'act:focus']));
  });

  it('kapalı modülün ayar bölümü ve arka plan servisleri kalkar', () => {
    const on = enabledModules(MODULES, off('browser', 'ambient', 'library', 'achievements'));
    expect(settingsOf(on).some((s) => s.section.id === 'adblock')).toBe(false);
    expect(servicesOf(on, 'shell-background')).toHaveLength(0);
    expect(servicesOf(on, 'app-all').some((s) => s.service.id === 'game-mode')).toBe(false);
    expect(servicesOf(on, 'shell-logic').some((s) => s.service.id === 'achievement-tracker')).toBe(false);
    expect(servicesOf(on, 'shell-logic').some((s) => s.service.id === 'quick-requests')).toBe(true);
  });

  it('servisler yuvaya göre süzülür', () => {
    const slots = ['app-all', 'app-main', 'shell-logic', 'shell-background', 'shell-overlay'] as const;
    const total = slots.reduce((n, s) => n + servicesOf(MODULES, s).length, 0);
    expect(total).toBe(MODULES.reduce((n, m) => n + (m.services?.length ?? 0), 0));
  });

  it('enabledIds ve isModuleEnabled tutarlı', () => {
    const states = off('radio');
    const ids = enabledIds(MODULES, states);
    expect(ids.has('radio')).toBe(false);
    expect(ids.has('home')).toBe(true);
    const radio = MODULES.find((m) => m.id === 'radio') as ModuleManifest;
    expect(isModuleEnabled(states, radio)).toBe(false);
  });

  it('panel/widget sahibi bulunur, kategoriler gruplanır', () => {
    expect(moduleOfPanel(MODULES, 'markets')?.id).toBe('markets');
    expect(moduleOfWidget(MODULES, 'habits')?.id).toBe('daily');
    const groups = groupByCategory(MODULES);
    expect(groups[0]?.category).toBe('core');
    expect(groups.flatMap((g) => g.modules)).toHaveLength(MODULES.length);
  });
});
