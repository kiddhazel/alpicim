# Alpicim tasarım sistemi (v0.4 "Aurora")

## 0. v0.4 görsel yön — "Aurora" (bu bölüm aşağıdakilerle çelişirse bu bölüm geçerlidir)

Ölçüler, tipografi ölçeği, en küçük metin 12px ve "panel başına tek araç çubuğu" kuralları aynen geçerli. Değişen: görünüm.

- **Zemin**: çok koyu (#07080c) + `body` üzerinde sabit, çok hafif "aurora" ışığı: sol üstte mor
  (rgb(139 124 255 / 0.16)), sağ altta camgöbeği (rgb(34 211 238 / 0.10)) büyük radyal degradeler + üstte ince ızgara
  dokusu yok (sade). Açık temada: #eef0f7 + pastel mor/turkuaz radyaller (opaklık ~0.25).
- **Cam yüzeyler**: panel `bg-surface` artık yarı saydam: koyu `rgb(20 22 30 / 0.72)`, açık `rgb(255 255 255 / 0.72)`;
  sınıf `glass` = `backdrop-filter: blur(20px) saturate(140%)` + 1px iç vurgu kenarı (`--glass-edge`: koyu
  rgb(255 255 255 / 0.08), açık rgb(255 255 255 / 0.9)) + `shadow-panel`. `surface-2` = koyu rgb(255 255 255 / 0.04)
  (açık rgb(15 23 42 / 0.04)), `surface-3` = koyu rgb(255 255 255 / 0.08) (açık rgb(15 23 42 / 0.07)) — yani iç kartlar
  zemin rengi değil, cam üstünde hafif ton farkıdır. Metin okunabilirliği için panel opaklığı 0.72'nin altına inmez.
- **Vurgu**: `--accent` #8b7cff (açık #6d5dfc), ikinci vurgu `--accent-2` #22d3ee (açık #0891b2). Sınıf
  `bg-accent-gradient` = `linear-gradient(135deg, var(--accent), var(--accent-2))`; birincil düğme, seçili sekme göstergesi,
  aktif dock öğesinin ışıltısı bunu kullanır. `text-gradient` = degrade metin (başlıklarda çok az kullanılır: saat).
  `accent-soft` = rgb(139 124 255 / 0.16).
- **Köşeler**: panel `rounded-3xl` (24px), kart `rounded-2xl` (16px), kontrol `rounded-xl` (12px), küçük `rounded-lg`.
- **Kabuk**:
  - Üst çubuk saydam (zemin görünür), 56px; çalışma alanları tek bir cam "hap" içinde segment (seçili segment
    `bg-surface-3` + altında 2px degrade çizgi değil, tam segment hafif ışıltı); ortada saat `text-lg font-display
    font-semibold` + tarih; sağda cam ikon düğmeleri.
  - Kenar çubuğu: ekrandan 12px içeride **yüzen dock**: `glass rounded-3xl`, dikey, 64px genişlik, öğeler 44px
    `rounded-2xl`; aktif öğe `bg-accent-soft text-accent` + hafif degrade ışıltı (`shadow-[0_0_24px_-6px_var(--accent)]`);
    hover'da sağda küçük cam etiket (tooltip) panel adını gösterir. Ayarlar altta.
  - Paneller: `glass rounded-3xl`; başlık 52px: ikon 32px'lik `rounded-xl bg-accent-soft text-accent` kare içinde,
    başlık `text-md font-semibold tracking-tight`, eylemler hover'da.
- **Widget'lar**: `rounded-2xl bg-surface-2` (cam üstünde ton), başlık ikonunun rengi `text-accent`; saat widget'ı
  `text-gradient`.
- **Hareket**: hover'da kartlar `translate-y-[-1px]` + `bg-surface-3` (150ms); performans modunda hareket yok.
- **Diyaloglar/palet/hızlı ayarlar**: `glass rounded-3xl`, arka plan `bg-black/50 backdrop-blur-md`.

---

# (v0.3 temel kuralları — ölçüler ve tipografi hâlâ geçerli)

Amaç: ikinci monitörde uzaktan da okunabilen, sakin ve modern bir kontrol merkezi. Az ama büyük öğe, net hiyerarşi,
çerçeve yerine yüzey farkı. Bu belge tüm bileşenler için bağlayıcıdır.

## 1. İlkeler

1. **Okunabilirlik önce**: arayüz metni en az **12px**. 10–11.5px kullanılmaz (tek istisna: `<kbd>` 11px).
2. **Bir panelde en fazla bir araç çubuğu satırı.** İkincil filtreler/sekmeler araç çubuğunun içine veya içeriğin başına alınır.
3. **Çerçeve yerine yüzey**: paneller `bg-surface` + yumuşak gölge; iç ayırıcılar mümkünse boşlukla. `border-line` yalnızca
   giriş kutuları, kartlar arası gerekli yerler ve listeler arası ince ayırıcılar için.
4. **Gizlenen ikincil eylemler**: panel başlığındaki "ayır/kapat", liste satırlarındaki eylemler `group-hover`/`focus-within`
   ile görünür (klavye erişimi korunur: `focus-visible:opacity-100`).
5. **Tutarlı ölçü**: 4px tabanlı boşluk; panel içi kenar boşluğu 16px (`p-4`), öğe arası 12px (`gap-3`).
6. Animasyon kısa ve az: `transition-colors`/`transition-opacity` 150ms. Performans modu kurallarına uyulur (mevcut CSS).
7. Tüm metinler `src/i18n/tr.ts`'ten gelir. Yeni metin gerekmedikçe ekleme yapılmaz.

## 2. Renk belirteçleri (index.css)

Bileşenler yalnızca anlamsal sınıfları kullanır: `bg-bg`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `border-line`,
`border-line-strong`, `text-fg`, `text-muted`, `text-faint`, `text-accent`, `bg-accent`, `bg-accent-soft`, `text-up`,
`text-down`, `text-warn`, `text-demo`, `text-danger`, `text-on-accent`. Sabit hex yazılmaz (TitleBar kapat kırmızısı hariç).

Koyu (varsayılan):
| belirteç | değer | kullanım |
|---|---|---|
| bg | #0b0d12 | pencere zemini, paneller arası boşluk |
| surface | #14171e | panel yüzeyi |
| surface-2 | #1b1f28 | panel içi kart, giriş kutusu |
| surface-3 | #252a35 | hover, seçili |
| border | rgb(255 255 255 / 0.07) | ince ayırıcı |
| border-strong | rgb(255 255 255 / 0.14) | giriş kutusu odak dışı kenar |
| text | #eceff4 | ana metin |
| muted | #a1a9b8 | ikincil metin |
| faint | #6f7787 | üçüncül metin, ipucu |
| accent | #7aa2ff | vurgu |
| accent-soft | rgb(122 162 255 / 0.14) | seçili zemin |
| up/down/warn/demo/danger | #4ade80 / #f87171 / #fbbf24 / #c084fc / #ef4444 | |
| on-accent | #0b1020 | vurgu üstü metin |

Açık tema: bg #eef0f4, surface #ffffff, surface-2 #f4f6f9, surface-3 #e8ebf0, border rgb(15 23 42 / 0.08),
border-strong rgb(15 23 42 / 0.16), text #121620, muted #4b5565, faint #8a93a3, accent #3d6be6,
accent-soft rgb(61 107 230 / 0.10), up #15803d, down #dc2626, warn #b45309, demo #9333ea, danger #dc2626, on-accent #ffffff.

Ek belirteçler: `--shadow-panel: 0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px rgb(0 0 0 / 0.25)` (açıkta
`0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)`), Tailwind'de `shadow-panel` olarak.
Köşe: panel `rounded-2xl` (16px), kart/kontrol `rounded-xl` (12px), küçük öğe `rounded-lg` (8px).

## 3. Tipografi

Taban `body` 14px, satır yüksekliği 1.5. Yazı tipi: `'Segoe UI Variable Text', 'Segoe UI', system-ui`; başlık/rakam için
`'Segoe UI Variable Display'` (`font-display` sınıfı). Tailwind'in hazır ölçeği kullanılır, keyfî `text-[11px]` yazılmaz:

| rol | sınıf |
|---|---|
| ipucu, meta, rozet | `text-xs` (12px) |
| ikincil metin, düğme, sekme | `text-sm` (13px) |
| ana metin, liste başlığı | `text-base` |
| panel başlığı | `text-[15px] font-semibold` (tek izinli keyfî boyut) |
| bölüm başlığı (büyük) | `text-lg font-semibold` |
| öne çıkan rakam (kur, sıcaklık) | `text-2xl`/`text-3xl font-display font-semibold tabular` |
| saat | `text-5xl`–`text-6xl font-display` |

index.css'te Tailwind ölçeği şöyle ayarlanır (`@theme`): `--text-xs: 12px; --text-sm: 13px; --text-base: 14px;
--text-md: 15px; --text-lg: 17px; --text-xl: 20px; --text-2xl: 24px; --text-3xl: 30px; --text-4xl: 38px;
--text-5xl: 48px; --text-6xl: 60px`. `text-md` yeni sınıftır (15px).

Bölüm etiketi (eski "uppercase 11px"): `text-xs font-semibold uppercase tracking-wide text-faint`.

## 4. Bileşen ölçüleri

- **IconButton**: md 36px (ikon 18), sm 30px (ikon 16), `rounded-lg`. Hover `bg-surface-3`.
- **Button**: yükseklik 36px, `px-3.5`, `text-sm font-medium`, `rounded-lg`; primary `bg-accent text-on-accent`.
- **TextInput/Select**: 36px, `rounded-lg`, `bg-surface-2`, kenar `border-line-strong`, odakta `border-accent` + `ring-2 ring-accent/25`.
- **Segmented**: 36px kap, 30px seçenek, `text-sm`.
- **Badge**: `text-xs`, `px-2 py-0.5`, `rounded-md`.
- **Toggle**: 22×40.
- **Panel çerçevesi (Shell)**: `rounded-2xl bg-surface shadow-panel`, kenarlık yok (sürükleme hedefinde `ring-2 ring-accent`).
  Başlık 48px: tutamaç (yalnız hover'da), ikon 18px `text-muted`, başlık `text-[15px] font-semibold`, eylemler hover'da.
  Başlık ile içerik arasında çizgi yok.
- **Panel araç çubuğu**: tek satır, `px-4 py-2.5`, öğeler `gap-2`; altında ince `border-b border-line` yalnızca liste başlıyorsa.
- **Liste satırı**: `px-4 py-3`, başlık `text-base` (okunmuşsa `text-muted`), meta `text-xs text-faint`, satırlar arası
  `divide-y divide-line`. Satır eylemleri hover'da.
- **Kart** (kur, uygulama, widget): `rounded-xl bg-surface-2 p-4`, hover `bg-surface-3`.
- **Diyalog / palet**: `rounded-2xl bg-surface shadow-2xl`, arka plan `bg-black/60 backdrop-blur-sm`, başlık `text-md`.
- **Boş/hata durumları (StateView)**: ikon 32px, başlık `text-base font-medium`, açıklama `text-sm text-muted max-w-sm`.

## 5. Kabuk (Shell) düzeni

- **Üst çubuk (52px)**: sol — uygulama ikonu + çalışma alanı sekmeleri (ikon + ad, `text-sm`, seçili `bg-surface-3 text-fg`);
  orta — saat (`text-md font-semibold tabular`) + tarih (`text-sm text-muted`); sağ — "Ara (Ctrl K)" düğmesi,
  hızlı ayarlar, tam ekran, (pencere modunda) sabitle/küçült/büyüt/kapat. CPU/RAM, medya ve düzen seçici üst çubuktan
  **kaldırılır**: düzen (iki/üç sütun/odak) ve "pencereleri ekrana yerleştir" hızlı ayarlara taşınır; medya ve sistem
  bilgisi ana ekran widget'larında zaten var.
- **Kenar çubuğu (64px)**: 44px düğmeler, ikon 20px, seçili panelde solda 3px vurgu çizgisi + `bg-accent-soft text-accent`;
  ayarlar en altta ayrı.
- **İçerik**: `p-3`, paneller arası `gap-3`; ayırıcı 12px genişliğinde, ortada 4px×32px tutamaç (hover'da görünür).
- **Sütun sayısı**: bir panelin asgari genişliği 480px (ultrawide'da en fazla seçili düzen kadar).

## 6. Widget panosu

Satır yüksekliği 88px, boşluk 12px. Widget: `rounded-xl bg-surface-2`, başlık 36px (`text-sm font-medium text-muted`,
ikon 16px), başlık çizgisi yok. İçerik metinleri en az `text-sm`; saat `text-5xl`, rakamlar `text-2xl+`.

## 7. Yapma

- `text-[10px]`, `text-[10.5px]`, `text-[11px]`, `text-[11.5px]`, `text-[12px]`, `text-[12.5px]`, `text-[13px]` gibi keyfî
  boyutlar (bunların yerine ölçek sınıfları).
- Bir panelde iç içe üç çubuk (başlık + araç + alt araç) — birleştir.
- Her öğeye çerçeve.
- İş mantığını değiştirmek, yeni bağımlılık eklemek, Rust dosyalarına dokunmak (bu tasarım işinin kapsamı dışında).
