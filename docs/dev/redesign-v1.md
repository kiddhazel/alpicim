# Alpicim 1.0 — Yeniden tasarım ve modül mimarisi

Karar (kullanıcı, 2026-10-26): **Yumuşak modern** (Windows 11 Fluent / macOS hissi), varsayılan **koyu**, eğlence
öğeleri **ayrı ve sade modüller**. Amaç: "AI slop" görüntüsünden çıkmak, modül ekosistemine hazırlanmak.
Bu belge `docs/design-system.md` (v0.4 Aurora) yerine geçer; geçiş bitince o belge bu kurallarla yeniden yazılır.

## 1. Görsel ilkeler

Yasak: gradyan zemin/yazı (`bg-accent-gradient`, `text-gradient`, aurora), parlama/neon, cam bulanıklığı her yerde,
widget başına ayrı renk, arayüzde emoji, süs amaçlı animasyon, aynı ekranda 3+ vurgu rengi.
Hiyerarşi renk ile değil **tipografi, boşluk ve yüzey katmanı** ile kurulur. Renk yalnız anlam taşır
(vurgu = etkileşim/seçili, yeşil/kırmızı = artış/azalış, sarı = uyarı).

## 2. Belirteçler (CSS değişkenleri, `src/index.css`)

| Belirteç | Koyu | Açık | Kullanım |
|---|---|---|---|
| `--bg` | #1b1b1d | #f3f3f5 | pencere zemini (opak) |
| `--layer-1` | #232326 | #fbfbfc | kenar çubuğu, durum çubuğu |
| `--card` | #2a2a2e | #ffffff | kart / panel yüzeyi |
| `--card-hover` | #313136 | #f7f7f9 | |
| `--control` | #34343a | #f0f0f3 | düğme/girdi zemini |
| `--stroke` | rgba(255,255,255,.07) | rgba(0,0,0,.07) | 1px kenar |
| `--stroke-strong` | rgba(255,255,255,.12) | rgba(0,0,0,.12) | odak dışı ayırıcı |
| `--text` | #f2f2f4 | #1c1c1f | birincil metin |
| `--text-2` | #a7a7ae | #5d5d66 | ikincil |
| `--text-3` | #74747c | #8b8b94 | ipucu/meta |
| `--accent` | #5b9cf5 | #2f6fde | tek vurgu (ileride Windows vurgu rengi seçilebilir) |
| `--accent-soft` | rgba(91,156,245,.14) | rgba(47,111,222,.10) | seçili satır, rozet |
| `--up` / `--down` / `--warn` | #4cc38a / #ef6461 / #e8b54a | #1f9d63 / #d4423f / #b7851b | yalnız veri anlamı |

- Köşe: kart 12px, kontrol 8px, küçük öğe 6px, hap 999px.
- Gölge: koyuda yok (kenar yeter); açıkta `0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04)`.
  Açılır menü/diyalog: `0 8px 28px rgba(0,0,0,.28)` + 1px `--stroke-strong`.
- Boşluk ölçeği: 4 · 8 · 12 · 16 · 24 · 32 · 48. Kart iç boşluğu 16 (yoğun 12).
- Hareket: 120–180 ms `cubic-bezier(.2,0,0,1)`; zıplama yok. `prefers-reduced-motion` → 0.

## 3. Tipografi

Yazı tipi: `"Segoe UI Variable Text", "Segoe UI", system-ui` (başlık: `"Segoe UI Variable Display"`). Web fontu yok.
Ölçek: 12 (meta) · 13 (yoğun liste) · 14 (gövde) · 16 (kart başlığı) · 20 (sayfa başlığı) · 28 (büyük değer) · 40 (saat).
Ağırlık yalnız 400 / 600. Rakamlar `tabular-nums`. Satır yüksekliği gövde 1.45, başlık 1.2.

## 4. Kabuk (Shell) düzeni

```
┌───────────┬──────────────────────────────────────────────┐
│ Alpicim   │  Sayfa başlığı        [sayfa araçları]  [⌘K] │  ← 48px üst çubuk (sürüklenebilir)
│───────────│──────────────────────────────────────────────│
│ ▸ Ana     │                                              │
│ ÇALIŞMA   │              içerik (sekme/bölme)            │
│ ▸ Notlar  │                                              │
│ BİLGİ     │                                              │
│ ▸ Haberler│                                              │
│ ...       │                                              │
│───────────│──────────────────────────────────────────────│
│ ⚙ Ayarlar │  durum çubuğu 32px: kur · medya · saat        │
└───────────┴──────────────────────────────────────────────┘
```
- Kenar çubuğu 232px (daraltılınca 56px yalnız simge), kategorilere göre gruplu, yalnız **etkin modüller**.
- Seçili öğe: `--accent-soft` zemin + vurgu renkli simge; diğerleri `--text-2`.
- Sayfa başına **tek araç çubuğu** üst çubukta; panel içinde ikinci başlık çubuğu yok.
- Durum çubuğu sade: kayan yazı isteğe bağlı ve varsayılan kapalı; mini oynatıcı tek satır.

## 5. Bileşen kuralları (`src/shared/ui/`)

Button (primary/secondary/ghost/danger; 32px, yoğun 28px), IconButton (32px kare), Input/TextInput, Select, Segmented,
Toggle, Card (`Card`, `CardHeader` [başlık 16/600 + sağda eylemler], `CardBody`), List/ListItem (44px, yoğun 36px),
Badge (nötr/vurgu/up/down/warn; 12px), EmptyState (simge 32 + başlık + tek cümle + tek eylem), Toolbar, Tabs,
Tooltip, Menu, Dialog, Toast. Simgeler lucide, 16px (liste) / 20px (gezinme), tek renk (`currentColor`).
Eski `glass`, `bg-accent-gradient`, `text-gradient` yardımcıları geçiş süresince yeni belirteçlere eşlenir, sonra silinir.

## 6. Modül mimarisi (`src/core/modules/`)

```ts
type ModuleCategory = 'core' | 'work' | 'info' | 'media' | 'games' | 'system' | 'fun';
interface ModuleManifest {
  id: string;                       // [a-z0-9-]
  titleKey: MessageKey; descriptionKey: MessageKey;
  icon: LucideIcon; category: ModuleCategory;
  defaultEnabled: boolean; required?: boolean;      // required: kapatılamaz (Ana, Ayarlar)
  panels?: PanelContribution[];     // { id, titleKey, icon, load: () => import(...) }
  widgets?: WidgetContribution[];   // mevcut widget tanımı (registry.ts biçimi)
  settings?: SettingsContribution[];// { id, titleKey, load } → Ayarlar'da modül bölümü
  commands?: () => PaletteCommand[];// palet komutları
  services?: ServiceContribution[]; // arka plan bileşenleri (Laila, başarım izleyici, FX…) — yalnız etkinse bağlanır
  integrations?: IntegrationId[];
}
```
- Tek kayıt listesi: `src/core/modules/index.ts`. `panels.ts`, widget kaydı, ayar bölümleri, palet ve kenar çubuğu
  bu listeden **türetilir**; bileşenler modül listesini elle bilmez.
- Etkin/kapalı durumu: store anahtarı `modules` (`sanitize` ile); kapalı modülün paneli, widget'ı, servisi, komutu görünmez
  ve hiçbir ağ isteği yapılmaz.
- Ayarlar → **Modüller** sayfası: kategoriye göre kartlar (simge, ad, açıklama, aç/kapat, "Ayarlar" bağlantısı).
- Rust tarafında `windows.rs` PANELS kaydı aynı kalır (ayrılabilir pencere için); yeni panel = manifest + PANELS satırı.

## 7. Eğlence katmanı (kategori `fun`)

Laila, Oyunlar, Laila'nın odası, Başarımlar, Şans kurabiyesi, Ruh hâli, Atasözü, Film/dizi: hepsi `fun` modülleri.
- Etkin kalırlar ama ana arayüzü boyamazlar: Laila yalnız durum çubuğu hizasında küçük; konuşma balonu nötr kart.
- Tema efektleri ("Ortam" modülü): hava efekti **varsayılan kapalı**; özel günler yalnız ince vurgu (ör. kenar çubuğu
  logosunda küçük simge, ana ekran selamında bir satır) — tam ekran süs yok. Saate göre ton değişimi yok (opak zemin).

## 8. Geçiş sırası

1. Belirteçler + bileşenler + tasarım galerisi (`?panel=__design`) — **kullanıcı onayı**.
2. Modül mimarisi + yeni Shell + Modüller sayfası (mevcut modüller manifeste taşınır, görünüm sonra).
3. Modül ekranlarının yeni bileşenlerle yeniden yazımı (gruplar paralel).
4. Eğlence katmanının sadeleştirilmesi, eski yardımcıların silinmesi, `design-system.md` yeniden yazımı, doğrulama.
