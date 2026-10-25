# Alpicim — Uygulama Planı

Kişisel masaüstü kontrol merkezi: haberler, kur/borsa ve Windows uygulama başlatıcısı;
kenarlıksız, ayrılabilir pencerelerle. Yerel çalışır; sunucu, hesap ya da bulut yok.

## 1. Ortam (ilk analiz, 2026-10-25)

| Konu | Durum |
|---|---|
| Hedef makine | Windows x64 (depo herhangi bir klasöre klonlanabilir) |
| Mevcut proje | Yok — klasör boştu, üzerine yazılan dosya yok |
| Geliştirme ortamı | Kod bulut çalışma alanında yazıldı; npm/crates.io erişimi orada kapalı olduğu için derleme ve testler Windows'ta `scripts\verify.cmd` ile çalıştırılır |
| Gerekenler (Windows) | Node.js 20+ (öneri 22 LTS), Rust (stable, MSVC), Visual Studio C++ Build Tools, WebView2 (Windows 11'de hazır) |

## 2. Teknoloji kararları

- **Tauri 2** (Rust) + **React 19** + **TypeScript (strict)** + **Vite**
- **Tailwind CSS v4** (`@tailwindcss/vite`), **lucide-react** ikonları
- Kalıcılık:
  - Kullanıcı verisi (ayarlar, haber kaynakları, yer imleri, izleme listesi) → `tauri-plugin-store` (`alpicim.json`)
  - Pencere düzeni (konum/boyut, ayrılmış paneller, üstte tutma) → Rust tarafında `layout.json`
  - Uygulama kısayolları → Rust tarafında `launcher.json` (başlatma yalnızca kayıtlı kimliklerle yapılır)
  - API anahtarları → Windows Kimlik Bilgisi Yöneticisi (`keyring` crate). Anahtar webview'e hiç geri dönmez.
- Ağ: Tüm HTTP istekleri Rust komutu `net_get` üzerinden (yalnız GET, http/https, 15 sn zaman aşımı, 5 MB sınır, ETag/Last-Modified desteği). Webview'e geniş HTTP izni verilmez.
- Ek paketler bilinçli olarak az: `fast-xml-parser` (RSS/TCMB XML), grafikler için kendi SVG bileşenimiz, sürükle-bırak için yerleşik HTML5 DnD.

## 3. Mimari

```
src/
  i18n/                 Türkçe metinler (tr.ts) + t() yardımcı fonksiyonu
  shared/lib/           store, olay yayını, zaman biçimleme, tauri köprüsü, hook'lar
  shared/ui/            TitleBar, IconButton, StateView (yükleniyor/boş/hata/çevrimdışı), Badge
  modules/window-manager/  panel kaydı, pencere servisleri, ana kabuk (Shell), düzen menüsü
  modules/news/         RSS ayrıştırma, tekrar ayıklama, kaynak yönetimi, NewsPanel
  modules/markets/      sağlayıcı adaptörleri (tcmb, frankfurter, twelvedata, demo), servis, MarketsPanel
  modules/launcher/     kısayol servisi (Rust komutları), LauncherPanel
  modules/settings/     ayar tipi, servis, SettingsPanel
src-tauri/src/
  lib.rs      eklentiler, komut kaydı, olaylar
  windows.rs  panel pencereleri, düzen kalıcılığı, monitör doğrulama, hazır düzenler
  tray.rs     sistem tepsisi menüsü
  net.rs      denetimli HTTP GET
  secrets.rs  Windows Kimlik Bilgisi Yöneticisi
  launcher.rs doğrulanmış kısayol başlatma
```

Kurallar: İş mantığı servislerde; React bileşenleri yalnız durum + görünüm. Sağlayıcılar ortak
`MarketProvider` arayüzünü uygular ve birbirinden bağımsızdır.

## 4. Pencere yönetimi tasarımı

- Tüm pencereler `decorations: false`, özel başlık çubuğu (`data-tauri-drag-region`), Windows gölgesi açık.
- Ana pencere (`main`): kenar çubuğu + içteki panel ızgarası (iki sütun / üç sütun / odak).
- Her panel "Ayır" ile `panel-<id>` etiketli ayrı pencereye taşınır; o pencerede "Ana düzene döndür" vardır.
- Rust, `Moved/Resized` olaylarında geometriyi bellekte günceller, 2 sn'de bir (değiştiyse) ve kapanışta diske yazar.
- Açılışta kayıtlı geometri tüm monitörlerin çalışma alanlarıyla karşılaştırılır; başlık çubuğu görünür değilse
  pencere birincil monitöre ortalanır ve sığacak şekilde küçültülür (`clamp_to_monitors`, birim testli).
- Ekran düzenleri (`arrange_windows`): açık pencereleri ana pencerenin monitöründe 2/3 sütuna böler veya
  seçili pencereyi çalışma alanına yayıp diğerlerini küçültür.
- Sistem tepsisi: göster, panelleri pencerede aç, düzenler, tamamen çık. Ana pencereyi kapatmak ayara göre tepsiye gizler.

## 5. Veri kaynakları

| Veri | Kaynak | Tür | Anahtar |
|---|---|---|---|
| Haberler | Google News RSS (tr/TR), kullanıcı RSS/Atom kaynakları | Başlık + kısa özet + bağlantı | Hayır |
| USD/TRY, EUR/TRY vb. | TCMB `today.xml` | Gösterge (referans) kur, iş günü 15:30 | Hayır |
| Çapraz kurlar + 30 günlük grafik | Frankfurter (ECB ve merkez bankaları) | Günlük referans | Hayır |
| Anlık döviz, ons altın, hisseler | Twelve Data | Piyasa fiyatı (plana göre gecikmeli olabilir) | Evet |
| Gram altın (TL) | XAU/USD × USD/TRY ÷ 31,1035 | Hesaplanmış | Twelve Data |
| Örnek | Yerleşik | **DEMO** etiketli | Hayır |

BIST desteği varsayılmaz: sembol eklenirken sağlayıcıya doğrulama isteği atılır, hata mesajı aynen gösterilir.

## 6. Aşamalar

1. **İskelet**: Vite/React/TS/Tailwind, Tauri yapılandırması, izinler, ikonlar, lint/test altyapısı. ✅
2. **Pencere altyapısı**: başlık çubuğu, ayır/döndür, üstte tutma, düzen kalıcılığı, monitör doğrulama, tepsi, hazır düzenler. ✅
3. **Haber merkezi**: kategoriler, RSS ayrıştırma, tekrar ayıklama, arama, yer imi, okundu, özel kaynaklar, durum ekranları, koşullu istek. ✅
4. **Piyasalar**: adaptörler, izleme listesi, sparkline/çizgi grafik, API anahtarı kurulumu, istek sınırı. ✅
5. **Uygulama başlatıcı**: dosya seçici, doğrulama, kategoriler, arama, favori, sürükle-sırala. ✅
6. **Ayarlar & belgeler**: tema, yenileme sıklıkları, varsayılan düzen, README/CLAUDE.md. ✅
7. **Doğrulama (Windows)**: `npm run typecheck`, `npm run lint`, `npm test`, `cargo test`, `npm run tauri dev`, `npm run tauri build`.

## 6b. v0.2 — tam ekran masaüstü merkezi (2026-10-25)

1. **Temel deneyim**: `display.rs` (kenarlıksız tam ekran, hedef monitör, monitör değişimi), `hotkeys.rs`, tepsi. ✅ (uygulama içi elle doğrulama bekliyor)
2. **Panel/widget altyapısı**: çalışma alanları, panel ağırlıkları + ayırıcılar, 12 sütunlu ızgara, 11 widget. ✅
3. **YouTube Music + tarayıcı**: tekil webview, ortak kalıcı profil, SMTC denetimleri, IsMuted; tarayıcıya palet isteği. ✅ (giriş akışı denenmedi)
4. **Pencere gömme**: `embed.rs` + canlı testler (Karakter Eşlem, Edge ✅; Store Not Defteri reddedilir). ✅ prototip
5. **Kişiselleştirme**: komut paleti, hızlı ayarlar, performans modu, akıllı kısayollar, Windows açılışında başlatma. ✅
6. **Kalite kontrolü**: otomatik testler ✅; tam uygulama denemesi Windows Uygulama Denetimi nedeniyle yapılamadı.

Bilinçli olarak yapılmayanlar: gerçek pencerenin sürükle-bırakla alınması (Win32'de güvenilir yolu yok), sistem ses
seviyesi denetimi, kullanıcı tanımlı sabit web panelleri (yer imleri + palet ile karşılanıyor).

## 7. Sonraki sürümler için fikirler

- Exe simgelerini Windows API ile çıkarma
- Haber kaynağı başına güncelleme sıklığı, bildirimler
- Ek piyasa sağlayıcıları (ör. Finnhub, Alpha Vantage) — aynı adaptör arayüzüyle
- Global kısayol ile panelleri çağırma, sanal masaüstü desteği
- Çoklu dil (en.ts eklenmesi)
