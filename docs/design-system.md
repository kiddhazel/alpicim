# Alpicim tasarım sistemi (v1.0)

Yumuşak modern (Windows 11 Fluent hissi), varsayılan koyu, açık tema desteklenir. Ayrıntılı gerekçe: `docs/dev/redesign-v1.md`.
Canlı örnek: tasarım galerisi (`?panel=__design`, `src/modules/design/DesignGallery.tsx`).

## 1. İlkeler

- Yasak: gradyan zemin/yazı, parlama/neon, cam bulanıklığı (`backdrop-blur`), widget/öğe başına renk, arayüzde emoji, süs
  animasyonu, aynı ekranda 3+ vurgu rengi.
- Hiyerarşi renkle değil **tipografi, boşluk ve yüzey katmanı** ile kurulur. Renk yalnız anlam taşır: vurgu = etkileşim/seçili,
  `up`/`down` = artış/azalış, `warn` = uyarı, `demo` = DEMO veri etiketi.
- Panel başına **tek araç çubuğu** (üst çubukta); panel içinde ikinci başlık çubuğu yok. En küçük metin 12px.
- Kabuk kökü opak zemin boyar (`--bg`); saate/havaya göre ton değişmez.

## 2. Belirteçler (`src/index.css`)

| Belirteç (Tailwind adı) | Koyu | Açık | Kullanım |
|---|---|---|---|
| `--bg` (`bg-bg`) | #1b1b1d | #f3f3f5 | pencere zemini |
| `--layer-1` (`bg-layer`) | #232326 | #fbfbfc | kenar çubuğu, durum çubuğu |
| `--card` / `--card-hover` | #2a2a2e / #313136 | #fff / #f7f7f9 | kart yüzeyi |
| `--control` / `--control-hover` (`bg-control`) | #34343a / #3c3c43 | #f0f0f3 / #e8e8ec | düğme, girdi, iz çubuğu |
| `--raised` | #3c3c43 | #fff | açılır menü, toast |
| `--stroke` / `--stroke-strong` (`border-stroke`) | beyaz %7 / %12 | siyah %7 / %12 | 1px kenar |
| `--text`, `--text-2`, `--text-3` (`text-fg`, `text-fg-2`, `text-fg-3`) | #f2f2f4 / #a7a7ae / #74747c | #1c1c1f / #5d5d66 / #8b8b94 | birincil / ikincil / meta |
| `--accent`, `--accent-hover`, `--accent-soft`, `--on-accent` | #5b9cf5 … | #2f6fde … | tek vurgu; seçili satır = `bg-accent-soft` |
| `--up`, `--down`, `--warn`, `--demo` | yeşil, kırmızı, sarı, mor | | yalnız veri anlamı |
| `--overlay`, `--shadow-pop` | | | diyalog arkası, açılır katman gölgesi (`shadow-pop`) |

- Köşe: kart 12px, kontrol 8px, küçük öğe 6px, hap 999px. Boşluk: 4 · 8 · 12 · 16 · 24 · 32 · 48; kart iç boşluğu 16 (yoğun 12).
- Gölge: koyuda yok (kenar yeter); yalnız açılır katmanlar `shadow-pop` + `ring-stroke-strong`.
- Hareket: 120–180 ms, zıplama yok; `prefers-reduced-motion` ve performans modunda kapalı.

## 3. Tipografi

`"Segoe UI Variable Text"/"Segoe UI"` (başlık: `Segoe UI Variable Display`), web fontu yok. Ölçek: 12 meta · 13 yoğun liste ·
14 gövde · 16 kart başlığı · 20 sayfa başlığı · 28 büyük değer · 40 saat. Ağırlık yalnız 400/600. Rakamlar `tabular-nums`.
Keyfî `text-[11px]` gibi boyutlar yazılmaz.

## 4. Kabuk

Sol kenar çubuğu (232px, daraltılınca 56px simge; kategoriye göre gruplu, yalnız etkin modüller; seçili = `bg-accent-soft`),
48px sürüklenebilir üst çubuk (sayfa başlığı + sayfa araçları + Ctrl+K), içerik (sekme/bölme sahnesi), 32px durum çubuğu
(kur · medya · saat). Ana ekran: selamlama + tarih + bilgi rozetleri (büyük saat yok; saat `Saat` widget'ında).

## 5. Bileşenler (`src/shared/ui/`)

- `primitives.tsx`: `Button` (primary/secondary/ghost/danger; 32px, yoğun 28px), `IconButton` (32px), `TextInput`, `Select`,
  `Field`, `Segmented`, `Toggle`, `Badge` (nötr/vurgu/up/down/warn/demo), `Card` / `CardHeader` / `CardBody`, `List` /
  `ListItem` (44px, yoğun 36px), `EmptyState` (simge + başlık + tek cümle + tek eylem), `Toolbar`, `Tabs`, `SectionTitle`, `cx`.
- `overlays.tsx`: `Tooltip`, `Menu`, `Dialog`. `Toast.tsx`: `ToastProvider`. `StateView.tsx`: yükleniyor/hata/boş, `SkeletonRows`.
- Simgeler lucide: 16px (liste) / 20px (gezinme), tek renk (`currentColor`).
- HTML katman açan bileşen yerel yüzeyler (alt webview, gömülü pencere) için `setOverlay` çağırır.

## 6. Yazım kuralları

Tüm metin `src/i18n/tr.ts` içinde. Veri türü etiketleri (`reference`/`market`/`derived`/`demo`) zorunludur; gerçek veri yoksa
sahte rakam gösterilmez.
