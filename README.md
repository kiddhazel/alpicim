# Alpicim

Alpicim, Windows için kişisel bir masaüstü merkezidir. Haberleri, piyasaları, notları, tarayıcıyı, müziği ve sık
kullanılan uygulamaları kenarlıksız, ayrılabilir pencerelerde bir arada tutar. Her özellik bağımsız bir **modüldür**;
istemediğinizi Ayarlar'dan kapatırsınız. İkinci monitörde tam ekran çalışacak şekilde tasarlandı. Tamamen yereldir:
sunucu, hesap veya bulut yoktur.

**Teknolojiler:** Tauri 2 · React 19 · TypeScript (strict) · Vite · Tailwind CSS 4

## Özellikler

### Çalışma
- **Ana ekran:** sürükle-bırak widget ızgarası (saat, takvim, yapılacaklar, bağlantılar, alışkanlıklar, geri sayım,
  döviz çevirici); çalışma alanları panel düzenini ve widget'ları kaydeder
- **Tarayıcı:** sekmeli ve bölünebilir; yerleşik reklam engelleyici (Brave motoru, YouTube reklam atlama)
- **Notlar:** Markdown destekli not defteri, arama, görev kutuları, hızlı not
- **Pano geçmişi:** metin geçmişi, sabitleme, arama (parola yöneticisi kopyaları atlanır)
- **Uygulamalar:** Başlat menüsünü tarar, uygulamaları arar ve kimlikle başlatır
- **Odak modu:** dikkat dağıtan bildirimleri susturur

### Bilgi
- **Haberler:** RSS/Atom kaynakları, kategoriler, yinelenen haberlerin birleştirilmesi, yer imleri, okundu durumu,
  özel kaynak ekleme
- **Piyasalar:** TCMB döviz kurları, altın, borsa ve grafikler; her veri `reference` / `market` / `derived` / `demo`
  etiketiyle işaretlenir
- **Hava durumu** ve **günün fotoğrafı** widget'ları
- Alt çubukta kurlar ve kayan haber şeridi

### Medya
- **YouTube Music** ve mini oynatıcı (Windows medya denetimleriyle)
- **Radyo** ve **Podcast'ler**

### Oyun
- **Oyunlar:** Yılan, 2048, Wordle, Adam Asmaca, Hafıza, Taş-Kâğıt-Makas, XOX
- **Oyun kütüphanesi:** oyunlarınızı listeler; oyun açıkken uygulamayı hafifletir

### Sistem
- **Pencere gömme:** başka uygulama pencerelerini panelin içine alır
- **Sistem izleme:** CPU, bellek, disk, GPU, ses karıştırıcı widget'ları
- **Ekran görüntüsü** ve ekran kaydı komutları, **hızlı pencere** (genel kısayolla arama/pano), **ekran koruyucu**
- Komut paleti (Ctrl+K), sistem tepsisi, tam ekran ve hedef monitör seçimi, Windows ile başlatma

### Eğlence
- **Laila:** piksel arkadaş (sohbet, hatırlatmalar, masaüstünde gezinme) ve **Laila'nın odası**
- **Başarımlar**, **ortam efektleri** (hava, özel günler, konfeti), şans kurabiyesi, ruh hâli günlüğü, atasözü,
  film/dizi listesi widget'ları

## Kurulum

1. [GitHub Releases](https://github.com/kiddhazel/alpicim/releases) sayfasından en son kurulum dosyasını (`.exe`) indirin
   ve çalıştırın.
2. Uygulama imzasızdır; Windows SmartScreen uyarısı görürseniz **Ek bilgi → Yine de çalıştır** deyin.
3. **WebView2** gerekir; Windows 11'de hazır gelir, Windows 10'da kurulum gerekirse yükler.

## Kısayollar

| Kısayol | İşlev | Kapsam |
|---|---|---|
| Ctrl+Alt+Space | Alpicim'i göster/gizle | Sistem çapı |
| Ctrl+Alt+F | Tam ekranı aç/kapat | Sistem çapı |
| Ctrl+Alt+K | Komut paletini aç | Sistem çapı |
| Alt+Space | Hızlı arama penceresi | Sistem çapı |
| Ctrl+Shift+V | Hızlı pano penceresi | Sistem çapı |
| Ctrl+K | Komut paleti | Uygulama içi |
| F11 | Tam ekran | Uygulama içi |

Sistem çapı kısayollar Ayarlar → Kısayollar'dan değiştirilebilir.

## Gizlilik ve güvenlik

- Her şey bilgisayarınızda kalır; hesap yoktur, telemetri yoktur. Veriler `%APPDATA%\com.alperen.alpicim\` altındadır.
- API anahtarları **Windows Kimlik Bilgisi Yöneticisi**'nde saklanır; arayüze (webview) hiç geri dönmez.
- Ağ istekleri yalnızca Rust tarafından yapılır (yalnız GET, http/https, zaman aşımı ve boyut sınırlı).
- Her dış hizmet bir **entegrasyondur** ve Ayarlar → Entegrasyonlar'dan kapatılabilir.
- Ücretli API gerekmez; anahtar isteyen sağlayıcılar (ör. Twelve Data) isteğe bağlıdır.
- Başlatıcı yalnızca kayıtlı uygulamaları açar; betik uzantıları engellenir, kabuk komutu çalıştırılmaz.

## Geliştirme

**Gereksinimler:** Node 22, Rust (stable, MSVC), Visual Studio Build Tools (C++), WebView2.

| Amaç | Komut |
|---|---|
| Bağımlılıklar | `npm install` |
| Geliştirici modu (Tauri + Vite) | `npm run tauri dev` |
| Yalnız arayüz (tarayıcı önizleme) | `npm run dev` → http://localhost:1420 (`?panel=news` ile tek panel) |
| Tip denetimi | `npm run typecheck` |
| Lint | `npm run lint` |
| Birim testleri | `npm test` |
| Rust denetimi + testleri | `npm run check:rust` |
| Hepsi | `npm run verify` |
| Kurulum paketi | `npm run tauri build` → `src-tauri\target\release\bundle\` |

**Yapı:** `src/core/modules` modül kaydı; `src/modules/<ad>` her modül (`manifest.ts` + bileşenler + servisler);
`src/shared` ortak kütüphane ve arayüz; `src/i18n/tr.ts` tüm metinler; `src-tauri/src` Rust tarafı (pencereler,
ağ, gizli anahtarlar, pano, gömme, reklam engelleyici).

**Yeni modül eklemek:**
1. `src/modules/<ad>/manifest.ts` oluşturun (panel, servis, widget, ayar ve palet girdileri).
2. Manifesti `src/core/modules/index.ts` içine ekleyin.
3. Panel ise `src-tauri/src/windows.rs` → `PANELS` listesine ekleyin; metinleri `tr.ts`'e yazın.

Tasarım kuralları: [`docs/design-system.md`](docs/design-system.md). Mimari ve proje kuralları:
[`CLAUDE.md`](CLAUDE.md). Geliştirici notları: [`docs/dev/`](docs/dev/).

## Bilinen sınırlar

- Başlatıcı taraması yalnızca Başlat menüsü ve masaüstü kısayollarını okur; kısayolsuz taşınabilir `.exe`'ler elle eklenir.
- TCMB kurları gösterge niteliğindedir (hafta sonu son bülten). Gram altın ve ons kurdan hesaplanır; kuyumcu fiyatı değildir.
- Ücretsiz Twelve Data planında bazı semboller kapalı veya gecikmeli olabilir.
- Ekran kaydı için kendi kodlayıcı yoktur; Windows'un Ekran Alıntısı Aracı açılır.
- Takvim aboneliği (.ics) yalnızca günlük/haftalık tekrarları destekler.
- **Pencere gömme:** Alpicim zorla sonlandırılırsa gömülü pencereler de kapanabilir; kaydedilmemiş işi olan
  uygulamaları gömmeyin. Store/UWP, yükseltilmiş ve kabuk pencereleri gömülemez; gömülü pencereler Alt+Tab'da
  görünmez, farklı DPI'da bulanık olabilir, sürükle-bırak ile gömme yoktur.
- Gömülü pencere odaktayken uygulama içi kısayollar (F11, Ctrl+K) o uygulamaya gider; sistem çapı kısayollar çalışır.
- Pencere geometrisi fiziksel piksel saklanır; farklı ölçekli monitörler arasında boyut değişebilir.
- YouTube Music'te Google girişinin gömülü WebView2'de kabul edilip edilmediği denenmedi.
- Release profilinde `lto`, `panic = "abort"` ve `strip` kapalıdır (Rust 1.99'da E0463 hatası).

## Lisans

Kişisel proje; lisans belirtilmedi.
