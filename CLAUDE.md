# CLAUDE.md — Alpicim

Kişisel Windows masaüstü kontrol merkezi: haberler, kur/borsa, uygulama başlatıcı; kenarlıksız, ayrılabilir pencereler.
Ayrıntılı plan: `docs/implementation-plan.md`. Kullanıcı belgeleri: `README.md` (Türkçe).

## Komutlar

| Amaç | Komut |
|---|---|
| Bağımlılıklar | `npm install` |
| Geliştirici modu (Tauri + Vite) | `npm run tauri dev` veya `scripts\dev.cmd` |
| Yalnız arayüz (tarayıcı önizleme, Rust yok) | `npm run dev` → http://localhost:1420 (`?panel=news` ile tek panel) |
| Tip denetimi | `npm run typecheck` |
| Lint | `npm run lint` |
| Birim testleri (TS) | `npm test` |
| Rust denetimi + testleri | `npm run check:rust` |
| Hepsi | `npm run verify` ya da `scripts\verify.cmd` (günlük: `logs\`) |
| Kurulum paketi | `npm run tauri build` → `src-tauri\target\release\bundle\{nsis,msi}` |

## Mimari

```
src/
  App.tsx                    Pencere etiketine göre: "main" → Shell, "panel-<id>" → DetachedWindow
  i18n/                      tr.ts (tüm metinler) + t() — anahtarlar derleme zamanında denetlenir
  shared/lib/                tauri.ts (call/AppError), store.ts (kalıcı KV + pencereler arası olay),
                             usePersistentState, net.ts (Rust net_get sarmalayıcı), time.ts, hooks.ts
  shared/ui/                 TitleBar, primitives (Button, IconButton, Badge, Segmented, Toggle…), StateView, Toast
  modules/window-manager/    panels.ts (panel kaydı), Shell, DetachedWindow, PanelHost, mainLayout, windowService
  modules/news/              rss.ts (RSS/Atom/RDF ayrıştırma), dedupe.ts, newsService.ts, useNews, NewsPanel, FeedManager
  modules/markets/           adapters/{tcmb,frankfurter,twelvedata,demo}.ts, marketService.ts, useMarkets, MarketsPanel, Chart
  modules/launcher/          launcherService.ts (Rust komutları), icons.ts, LauncherPanel
  modules/settings/          settings.ts (tip, varsayılan, doğrulama, tema), SettingsPanel, Display/WorkspaceSettings
  modules/integrations/      registry.ts (tüm dış hizmetler: kategori, anahtar, kontrol türü; "integrations" anahtarı,
                             sanitize), integrationsService (assertIntegrationEnabled, anahtar kaydet/sil/durum),
                             integrationTests ("Test et"), useIntegrations, IntegrationsSettings (Ayarlar → Entegrasyonlar)
  modules/workspaces/        workspaces.ts: çalışma alanı = panel düzeni + ağırlıklar + widget listesi ("workspaces" anahtarı)
  modules/widgets/           grid.ts (saf ızgara), registry.ts, WidgetBoard ("home" paneli), WidgetFrame, basic/, data/, weather/,
                             daily/ (habits.ts, countdown.ts, converter.ts saf + testli; Alışkanlıklar, Geri sayım,
                             Döviz çevirici [yalnız TCMB `reference`], Not defteri [notebook deposuna yazar])
  modules/notebook/          notebook.ts (saf: not CRUD, başlık/önizleme, arama, görev kutusu), markdown.ts (güvenli
                             ayrıştırıcı → veri ağacı; HTML yok, yalnız http/https bağlantı), MarkdownView, NotesPanel
                             ("notes" paneli); notebookService: useNotebook ("notebook"), requestNotebook
                             ("notebook.request" {action:new|open,id,at} — palet/widget paneli yönlendirir), captureNote
  modules/clipboard/         clipboard.ts (saf süzme/önizleme), clipboardService (Rust komutları + `alpicim://clipboard`
                             olayı), ClipboardPanel ("clipboard" paneli; Tauri dışında "masaüstü gerekli")
  modules/display/           displayService (monitör, tam ekran, kısayol, autostart), MonitorSelect
  modules/system/            systemService (CPU/RAM/disk, SMTC medya), MediaControls
  modules/music/             musicService, MusicPanel (tekil "music" webview)
  modules/browser/           tabs.ts (saf sekme/bölme modeli, testli), useBrowserTabs (tembel webview yaşam döngüsü,
                             "browser.tabs" anahtarı), useTabAdblock (kalkan), BrowserPanel/TabStrip/BrowserPane/StartPage;
                             adblockService (Rust sözleşmesi), useAdblock + AdblockSettings (Ayarlar → Reklam engelleyici)
  modules/apps/              embedService, useEmbeddedApps, AppsPanel, WindowPicker (pencere gömme)
  modules/palette/           palette.ts (saf sıralama), CommandPalette (Ctrl+K)
  modules/ticker/            ticker.ts (saf seçim/biçim), useTicker, TickerBar (alt çubuk: kurlar + kayan haberler)
  modules/music/MiniPlayer   useMiniPlayer: arama (music_search), SMTC denetimleri, ilerleme, genişletilmiş oynatıcı
  Shell                      "sahne": docked = sekmeler, focused = birincil, secondary = sağ bölme; tüm sekmeler
                             bağlı kalır, etkin olmayanlar `hidden` (yerel yüzeyler 0×0 olunca kendini gizler);
                             paneller PanelHost'ta React.lazy ile yüklenir; `PanelVisibleContext` + `useActiveView()`
                             (hooks.ts) gizli sekme/pencerede periyodik yenilemeleri durdurmak için kullanılır
src-tauri/src/
  display.rs                 kenarlıksız tam ekran, hedef monitör, monitör değişimi denetimi
  hotkeys.rs                 RegisterHotKey iş parçacığı, kısayol çözümleme
  embed.rs                   pencere listeleme/gömme/geri alma (SetParent), canlı testler (#[ignore])
  music.rs                   YouTube Music alt webview'i (reparent, IsMuted)
  browser.rs                 sekme başına alt webview `<pencere>-browser-<sekme>` (kimlik [a-z0-9-]{1,24}); olay
                             `alpicim://browser` {owner, tab, kind: state|newTab, url, title, loading}; adblock::attach
  adblock.rs                 reklam engelleyici (Brave `adblock` 0.13, Send+Sync motor, küresel Arc): WebView2
                             WebResourceRequested ("*") → 403, CSS gizleme (ExecuteScript), YouTube budama/atlama
                             betiği; listeler Rust'ta indirilir (`%LOCALAPPDATA%\…\adblock\`, 4 gün), `adblock.json`;
                             `attach(&app, &webview)` her alt webview'de çağrılır; olay `alpicim://adblock` {label, blocked}
  system.rs                  sistem kaynakları, HKCU Run, SMTC
  clipboard.rs               pano geçmişi: `alpicim-clipboard` iş parçacığı, yalnız-ileti penceresi +
                             AddClipboardFormatListener; CF_UNICODETEXT, ≤20 KB, en çok 100 (sabitliler korunur),
                             parola yöneticisi işaretleri atlanır; `clipboard.json`; panoya yazma aynı iş parçacığında
                             (`on_thread`); komutlar clipboard_{list,copy,delete,clear,set_paused,pin}
  lib.rs                     eklentiler, setup, komut kaydı
  windows.rs                 panel pencereleri, layout.json, olaylar, hazır düzenler, tepsiye gizleme
  geometry.rs                saf geometri: clamp_to_monitors, tile (birim testli)
  tray.rs                    sistem tepsisi menüsü
  net.rs                     net_get: yalnız GET, http/https, 15 sn, 5 MB, ETag; sağlayıcı anahtarını ekler
                             (anahtarlı istek: yönlendirme yok, hata metninde adres yok)
  providers.rs               anahtarlı sağlayıcı tablosu (id, sunucu, Auth::Header|Query) — secrets + net ortak
  secrets.rs                 Windows Kimlik Bilgisi Yöneticisi (keyring crate); anahtar biçimi: görünür ASCII ≤512
  scanner.rs                 Başlat menüsü/masaüstü taraması (IShellLinkW), simge çıkarma (SHGetFileInfo → PNG)
  launcher.rs                launcher.json, doğrulama, kimlikle başlatma (opener eklentisi)
```

Veri konumları (Windows): `%APPDATA%\com.alperen.alpicim\` → `alpicim.json` (store), `layout.json`, `launcher.json`, `clipboard.json`.

## Kurallar

- **Tasarım**: `docs/design-system.md` bağlayıcıdır (v0.4 "Aurora": `glass`, `bg-accent-gradient`, `text-gradient`
  yardımcıları; yarı saydam yüzey belirteçleri; en küçük metin 12px; panel başına tek araç çubuğu). Kabuk kökü opak
  zemin boyamaz (aurora `body` üzerinde). Keyfî `text-[11px]` gibi boyutlar yazılmaz.

- **İş mantığı bileşenlerde değil**: servis/adaptör/hook katmanında. Bileşenler yalnız durum + görünüm.
- **Yeni panel**: `panels.ts` kaydı + `PanelHost.tsx` eşlemesi + `windows.rs` → `PANELS` + `tr.ts` başlığı.
- **Yeni widget**: ayrı bileşen + `defaults`/`sanitize` + `widgets/registry.ts` kaydı + `workspaces.ts` → `WIDGET_TYPES` + `tr.ts`.
- **Yerel yüzeyler** (alt webview, gömülü pencere) HTML'in üstünde çizilir: HTML katman açan her bileşen `setOverlay` çağırmalı.
- **Yeni piyasa sağlayıcısı**: `adapters/provider.ts` arayüzlerinden birini uygulayan ayrı dosya; anahtar gerekiyorsa
  `providers.rs::PROVIDERS` (kimlik, sunucu, başlık/sorgu biçimi) güncellenir. Anahtar asla webview'e dönmez.
- **Her dış hizmet bir entegrasyondur**: `integrations/registry.ts` kaydı + `tr.ts` → `integrations.items.<id>`; servis
  ağa çıkmadan önce `assertIntegrationEnabled(id)` çağırır (kapalıysa `AppError('DISABLED')` → "Ayarlar → Entegrasyonlar").
  Depoya kişisel veri (anahtar, yol, şehir, hesap) yazılmaz; varsayılanlar geneldir.
- **Veri türü etiketleri zorunlu**: `reference` / `market` / `derived` / `demo`. Gerçek veri yoksa sahte rakam gösterilmez;
  DEMO yalnızca ayarlardan açıkça açılır ve belirgin etiketlenir.
- **Ağ**: webview doğrudan fetch yapmaz; `netGet()` → Rust `net_get`. Capability'e geniş HTTP izni eklenmez.
- **Başlatıcı**: yalnızca kayıtlı kimlikle açılır, betik uzantıları engellenir, kabuk komutu/argüman yoktur.
- **Metinler**: tüm arayüz metni `src/i18n/tr.ts` içinde; bileşende sabit Türkçe metin yazılmaz (servis notları hariç).
- TypeScript `strict` + `noUncheckedIndexedAccess`; `any` kullanılmaz. Kalıcı veriler okunurken `sanitize*` ile doğrulanır.
- Bir özellik çalışmıyorsa tamamlanmış gibi işaretlenmez; README'deki "Bilinen sınırlar" güncel tutulur.
- Tauri izinleri: `src-tauri/capabilities/default.json` — en az yetki ilkesi.

## Doğrulama geçmişi

- 2026-10-25, Windows 11 (26300), Node 22.23.4, Rust 1.99.1, VS Build Tools 2022, WebView2 155:
  `npm install`, typecheck, lint, vitest, `vite build`, `cargo check`, `cargo test`, `tauri build` (NSIS + MSI) başarılı.
- Elle denenenler (`tauri dev`): kenarlıksız pencere, haberler (404 haber / 7 kategori), TCMB kurları + Frankfurter grafikleri,
  panel ayırma ve geri döndürme, pencere sürükleme, "iki sütun" ekran düzeni, üstte tut (kalıcı), başlatıcıya .exe ekleme
  ve çalıştırma, tamamen çık → yeniden aç ile düzenin geri gelmesi.
- Henüz denenmeyenler: Twelve Data (anahtar yok), ikinci monitör çıkarıldığında taşıma (yalnızca birim testi), tepsi menüsü.
- 2026-10-25 (v0.2): typecheck, lint, vitest (67 test), `cargo check`, `cargo test` (31 birim) başarılı.
  Canlı gömme testleri (`cargo test -- --ignored --test-threads=1`): Karakter Eşlem ✅, Edge/Chromium ✅,
  Store Not Defteri reddediliyor ✅, görev çubuğu reddediliyor ✅. Arayüz Vite önizlemesinde denendi (palet, çalışma alanı
  geçişi, panel ayırıcı, widget sürükleme, kalıcılık).
- 2026-10-25 (v0.2, uygulama içi, `tauri dev`): tam ekran (ikinci monitör, F11, Ctrl+Alt+F, yeniden açılışta korunma,
  büyütülmüş hâle dönüş), Hedef ekrana taşı, göster/gizle kısayolu + tepsi, Ctrl+Alt+K, palet, çalışma alanı geçişi,
  YouTube Music (oynatma, SMTC bilgi/duraklat/sonraki, sessize alma, gizliyken çalma), Karakter Eşlem gömme (kapsayıcı) ✅.
  Bulunan ve düzeltilen hatalar: alt webview eklenince `get_webview_window("main")` None dönüyordu (→ `get_window`);
  tam ekrana girerken `unmaximize` pencereyi birincil monitöre atıyordu; `is_focused()` WebView2 odaktayken false;
  doğrudan gömmede GDI pencereleri görünmüyor ve Discord fare girdisini kilitliyordu (→ kapsayıcı iş parçacığı);
  WebView2 SMTC kimliği `msedgewebview2`.
- 2026-10-25: Discord kapsayıcı mimarisiyle uygulama içinde ✅ (fare, klavye, tam ekran, gizle/göster, otomatik yeniden
  yerleşme, panelden çıkarma). Düzeltilenler: kapsayıcı odağı dış pencereye aktarmıyordu (`WM_SETFOCUS`);
  simge durumunda gömülen pencere panelden küçültülmüş dönüyordu (kaydedilen stil/placement normalleştirildi).

## Pencere gömme kuralları

- Store (`\WindowsApps\`), UWP, yükseltilmiş ve kabuk pencereleri `embed::classify` ile reddedilir; yeni istisna eklerken canlı test yaz.
- Ebeveyn pencere yok edilmeden önce `embed::release_*` çağrılmalı (çıkış, panel penceresi kapanışı, panik kancası).
- Gömme komutları async olmalı; `SetWindowPos` her zaman `SWP_ASYNCWINDOWPOS` ile (askıda uygulama Alpicim'i kilitlemesin).
- Dış pencereler **asla doğrudan Tauri penceresine** alınmaz: `alpicim-embed` iş parçacığının kapsayıcısına alınır
  (`on_host`/`post_host`). Ana iş parçacığı olay işleyicilerinden yalnızca `post_host` (beklemesiz) çağrılır.
- Tauri penceresine alt webview eklenince `get_webview_window` None döner: pencere işlemleri için `get_window` kullan.
- `tauri dev` çalışırken gömülü pencere varsa Rust dosyası değiştirme: yeniden başlatma süreci zorla kapatır ve dış pencere yok olabilir.

## Bilinen tuzaklar

- **Bilgisayara dosya gönderirken** aynı geçici yolu tekrar kullanma: köprü eski içeriği yazabiliyor. Her gönderim için yeni klasör kullan ve boyutları doğrula.

- **Kurulumu Claude oturumundan doğrudan çalıştırma**: Claude masaüstü uygulaması paketli (MSIX) olduğundan alt
  süreçlerin `%LOCALAPPDATA%`/`%APPDATA%` yazımları `Packages\Claude_…\LocalCache` içine sanallaşır; kullanıcı programı
  göremez. Kurulumu `explorer.exe <setup.exe>` ile başlat (Gezgin oturumu dışında, gerçek konuma kurar).
- **Windows'ta pencere oluşturan komutlar `async` olmalı** (senkron komutta `WebviewWindowBuilder::build` kilitlenir).
- TCMB'ye ilk bağlantı ~9 sn sürebiliyor: `net.rs` zaman aşımları 20/30 sn.
- Release profilinde `lto`/`panic="abort"`/`strip` açılınca Rust 1.99'da `zerovec_derive` E0463 hatası veriyor.
