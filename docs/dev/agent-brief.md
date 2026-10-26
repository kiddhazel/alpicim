# Ortak kurallar (paralel alt ajanlar)

- Önce `CLAUDE.md` → "Kurallar" ve gerekirse `docs/design-system.md` (Aurora; en küçük metin 12px; `glass`).
- Windows: `npm.cmd`. `tauri dev` açık olabilir (HMR): Rust'a dokunacaksan yalnızca görevin Rust içeriyorsa; Rust değişince uygulama yeniden başlar, sorun değil.
- Paylaşılan dosyalar (tr.ts, settings.ts, SettingsPanel.tsx, widgets/registry.ts, widgets/types.ts, workspaces.ts WIDGET_TYPES, WidgetFrame.tsx HUES, panels.ts, PanelHost.tsx, windows.rs PANELS, lib.rs): **düzenlemeden hemen önce yeniden oku**, küçük ve yerel ekleme yap, başkasının satırına dokunma, dosyayı yeniden biçimlendirme (prettier --write YASAK).
- tr.ts: kendi bölümünü `  laila: {` satırının hemen ÖNÜNE ekle (Laila metinleri hariç).
- Yeni widget: CLAUDE.md "Yeni widget" + `widgets/types.ts` WidgetType birleşimi + `WidgetFrame.tsx` HUES kaydı.
- Yeni panel: panels.ts + PanelHost.tsx + windows.rs PANELS + tr.ts `panels.<id>`.
- Başarım sayaçları: `src/shared/lib/track.ts` → `track('todo.done')`, `trackMax('games.snake.score', n)`. Yeni sayaç gerekirse TrackCounter birleşimine ekle.
- Dış ağ: yalnız ücretsiz + anahtarsız kaynak, `netGet()` üzerinden, `integrations/registry.ts` kaydı + `assertIntegrationEnabled`.
- Saf mantık ayrı dosyada + Vitest testi. Bitirince: `npm.cmd run typecheck`, `lint`, `test` (Rust değiştirdiysen `check:rust`). Başka ajanın yarım dosyasındaki hatayı düzeltme, raporla.
- **Yeniden tasarım turu (v1.0)**: `docs/dev/redesign-v1.md` §1–5 bağlayıcı; galeri `src/modules/design/DesignGallery.tsx`
  örnek alınır (aynı kart/liste/başlık düzeni). Yeni bileşenleri kullan (`Card`, `CardHeader`, `List`, `ListItem`,
  `EmptyState`, `Toolbar`, `Tabs`, overlays.tsx); `glass`, `bg-accent-gradient`, `text-gradient`, widget başına renk
  (HUES), emoji, süs animasyonu kaldır; yeni sınıf adları (`bg-card`, `bg-layer`, `border-stroke`, `text-fg-2/3`).
  Davranış, veri ve testler değişmez — yalnız görünüm/düzen. Shell, TitleBar, SettingsPanel, CommandPalette, QuickSettings,
  `src/core/modules/*` ve `*/manifest.ts` dosyalarına dokunma (ayrı adım).
- Rapor ≤8 satır: dosyalar, yapılmayanlar, uygulamada denenmedi notu.
