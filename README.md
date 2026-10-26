# Alpicim

Ekranı verimli kullanmak için kişisel masaüstü kontrol merkezi. Haberleri, döviz/piyasa verilerini ve sık kullanılan
Windows uygulamalarını kenarlıksız, ayrılabilir pencerelerde bir arada tutar. Tamamen yerel çalışır: sunucu, hesap
veya bulut altyapısı yoktur.

**Teknolojiler:** Tauri 2 · React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Lucide

---

## Özellikler (v0.1)

### Pencere yönetimi
- Kenarlıksız pencereler, özel başlık çubuğu (sürükle, çift tıkla büyüt, küçült, kapat)
- Her pencere için **her zaman üstte** (raptiye düğmesi) — kalıcı
- Paneller ana pencerede sekme olarak açılır (bkz. "Akıllı pencere yöneticisi"); her panel **"Ayrı pencerede aç"** ile
  ayrılır, ayrılmış pencerede **"Ana düzene döndür"** ile geri gelir
- Konum, boyut, büyütülmüş durum ve açık paneller kaydedilir; yeniden açılışta geri yüklenir
- Kayıtlı konum artık bağlı olmayan bir monitördeyse pencere birincil monitöre taşınır
- Sistem tepsisi: göster/gizle, tam ekran, panelleri pencerede aç, **Tamamen çık**
- Ana pencereyi kapatmak varsayılan olarak tepsiye gizler (Ayarlar'dan değiştirilebilir)
- Tek örnek: uygulama ikinci kez açılırsa mevcut pencere öne gelir

### Haber merkezi
- Kategoriler: Türkiye, Dünya, Ekonomi, Teknoloji, Bilim, Oyun, Spor (Google Haberler RSS, Türkçe)
- Başlık, kaynak, yayın zamanı, varsa kısa açıklama; **orijinal kaynağa** bağlantı (varsayılan tarayıcıda açılır)
- Tekrarlanan haberlerin ayıklanması (aynı bağlantı / aynı veya çok benzer başlık → "+N kaynak")
- Arama, kategori filtresi, **yer imleri**, **okundu/okunmadı**, görünenleri okundu işaretleme
- Özel RSS/Atom kaynağı ekleme (eklemeden önce doğrulanır), kaldırma, açma/kapama, varsayılanlara dönme
- Arka planda yenileme; taze kaynaklar atlanır, **ETag/Last-Modified** ile değişmeyen akış yeniden indirilmez,
  aynı kaynağa dakikada en fazla bir istek
- Yükleniyor, boş, çevrimdışı, kısmi hata, tümü başarısız ve **eski içerik** durum ekranları

### Kur ve borsa
- **TCMB gösterge kurları** (USD/TRY, EUR/TRY, GBP/TRY; listeye TCMB'nin yayımladığı diğer kurlar eklenebilir) —
  önceki bültene göre değişim
- **30 günlük referans grafiği** (Frankfurter — merkez bankası serileri)
- **Piyasa fiyatları** (Twelve Data, API anahtarıyla): anlık döviz, ons altın (XAU/USD), **gram altın (hesaplanmış)**
- **İzleme listesi**: sembol ekle/çıkar; eklemeden önce sağlayıcıdan doğrulanır; satıra tıklayınca günlük grafik
- Her fiyatta **veri türü** (Referans / Piyasa / Hesaplanmış / DEMO), **kaynak** ve **zaman** gösterilir
- Veri alınamazsa son başarılı değer zaman damgasıyla gösterilir; hiç yoksa kurulum ekranı. Sahte rakam gösterilmez;
  DEMO verisi yalnızca Ayarlar'dan açıkça açılırsa ve mor **DEMO** etiketiyle görünür

### Uygulama merkezi
- **Bilgisayarı tara**: Başlat menüsü ve masaüstündeki kısayollar okunur, hedefleri (.exe) çözülür; Steam/Epic gibi
  başlatıcıların oyun kısayolları da bulunur. Kaldırıcılar, yardım dosyaları ve Windows/SDK araçları ayıklanır.
- Bulunanlar otomatik olarak **Oyun, İletişim, İnternet, Üretkenlik, Geliştirme, Medya ve Tasarım, Sistem ve Araçlar,
  Diğer** kategorilerine ayrılır; eklemeden önce kategoriyi değiştirip seçim yapabilirsiniz.
- Kartlarda uygulamanın **kendi Windows simgesi** gösterilir (önbellek: `%LOCALAPPDATA%\com.alperen.alpicim\icons`).
- "Tümü" görünümü kategorilere göre bölümlere ayrılır; kategori filtreleri üstte.
- Dosya seçiciyle **.exe, .lnk/.url kısayolu, klasör veya dosya** ekleme
- Kart tıklanınca hedef açılır; silinmiş/taşınmış hedefler "Bulunamadı" olarak işaretlenir
- Ad, simge, kategori düzenleme; favoriler; arama; kategori filtresi; **sürükle-bırak** (veya oklarla) sıralama
- Güvenlik: yalnızca kayıtlı öğeler kimlikle açılır, hedef her seferinde yeniden doğrulanır; `.bat/.cmd/.ps1/.vbs/…`
  betikleri eklenemez; komut satırı/kabuk komutu desteklenmez

### Ayarlar
- Tema (koyu / açık / sistem), haber ve piyasa yenileme sıklığı, tepsiye gizleme,
  **Entegrasyonlar** (her dış hizmeti aç/kapat, kendi API anahtarlarınızı girin/test edin), DEMO verisi, uygulamadan tamamen çıkış

## v0.8 Laila

- Laila, alt çubukta yürüyen piksel art karakterdir; widget'ların arkasına saklanır, ara sıra çıkıp konuşur.
- Konuşmalar hazır cümlelerdir (internet ve yapay zekâ yok). Karaktere tıklayarak sohbet edilir.
- Bazen ana monitörde görev çubuğu boyunca küçük, saydam bir pencerede yürür ve sonra geri döner.
- Ayarlar → Özellikler → Laila bölümünden kapatılabilir veya konuşma sıklığı değiştirilebilir.

## Akıllı pencere yöneticisi (v0.5)

- **Sahne:** ortada tek ana görünüm; açık görünümler üstte sekme (sürükleyerek sırala, üzerine gelince kapat / "sağa
  sabitle"). Hızlı ayarlardaki **Bölünmüş görünüm** ile sağa ikinci görünüm alınır (aradaki ayırıcı sürüklenir).
  Sekmeler arasında geçerken görünümler kapatılmaz, yalnızca gizlenir: tarayıcı oturumu ve gömülü pencereler korunur.
- **Alt çubuk:** solda kur çipleri (veri türü etiketli; tıklayınca Piyasalar sekmesi), ortada kayan haber başlıkları
  (üzerine gelince durur; tıklayınca haber açılır; "Tümü" Haberler sekmesini açar; performans modunda kaymaz, 6 sn'de bir
  değişir), sağda **YouTube Music mini oynatıcı**: arama, önceki/oynat/sonraki, parça adı, süre ve ilerleme çubuğu
  (Windows medya oturumundan), sessize alma.
- **Arama:** mini oynatıcıda aranan şey resmî YouTube Music arama sayfasında açılır — YouTube Music sekmesi açıksa
  orada, değilse sahnenin üstünde açılan geniş oynatıcı penceresinde. Şarkı seçip pencereyi kapatınca müzik çalmaya
  devam eder (uygulama içinde doğrulandı).
- Hazır çalışma alanlarında Haberler, Piyasalar ve YouTube Music artık varsayılan olarak sekme açmaz (alt çubukta
  yaşarlar); istenirse kenar dock'undan veya alt çubuktan sekme olarak açılır.

### v0.7 modül tasarımları
- Sahnedeki paneller artık ayrı başlık çubuğu taşımaz (sekme adlandırır); "ayrı pencerede aç" sekmeye taşındı.
- **Ana ekran:** üstte karşılama alanı (günün saatine göre selam, tarih, büyük degrade saat; hava durumu widget'ı
  varsa hava, takvimde etkinlik varsa sıradaki etkinlik, işlemci/bellek çipleri). Widget ızgarası ortalanmış en fazla
  1600px genişlikte; her widget türünün kendi renk tonu var.
- **Uygulamalar:** Launchpad düzeni — ortada büyük arama, solda sayılı kategoriler, başlıksız büyük ikonlar,
  en üstte son kullanılanlar.
- **Ayarlar:** iki bölmeli (solda kategoriler, sağda seçili bölüm).
- **Haberler:** kategori renkleri, manşet kartı + üç öne çıkan haber, renk şeritli liste, okuma bölmesi.
- **Piyasalar:** cam kartlar, renkli değişim etiketleri, seçili kur için başlıklı büyük grafik.

### v0.6 eklemeleri
- **Sekme kısayolları:** `Ctrl+Tab` / `Ctrl+Shift+Tab` sonraki/önceki sekme, `Ctrl+W` sekmeyi kapat (son sekme kapanmaz),
  `Ctrl+T` sekme ekle menüsü, `Ctrl+\` bölünmüş görünüm; palette de var.
- **Alt çubuk ayarları** (Ayarlar → Alt çubuk): şeridi / mini oynatıcıyı gizleme, kayma hızı, haber kategorisi, kur sayısı.
- **Geniş ekran düzenleri** (panel en az 1100px genişken): Haberler'de liste + okuma bölmesi (↑/↓/Enter), Piyasalar'da
  kart ızgarası + seçili kur için büyük 30 günlük grafik + sağda izleme tablosu. Dar bölmede eski tek sütun kalır.
- **Uygulamalar:** "Son kullanılanlar" ve "En sık" satırları (kullanım yerel olarak `launcher.usage` anahtarında tutulur).
- **Yeni widget'lar:** Takvim (ay görünümü, yerel etkinlikler, yaklaşan 7 gün) ve Hızlı bağlantılar (uygulamanın tarayıcı
  sekmesinde açılır). Harici takvim/API yok.

### Günlük kullanım: notlar, pano geçmişi ve yeni widget'lar
- **Notlar paneli** (kenar dock'u → Notlar): çoklu not defteri. Solda arama + liste (sabitlenenler üstte, sonra son
  düzenlenen), sağda düzenleyici; ilk satır notun başlığıdır. **Yaz / Önizle / Yan yana** görünümleri; Markdown
  önizlemesi kendi küçük ayrıştırıcısıyla güvenle çizilir (ham HTML hiç yorumlanmaz): `#` başlık, `**kalın**`,
  `*italik*`, `` `kod` ``, kod bloğu, listeler, `> alıntı`, `---`, `- [ ]` görev kutuları (önizlemede tıklanınca nota
  yazılır) ve bağlantılar (yalnızca http/https; uygulamanın tarayıcı sekmesinde açılır). Liste satırında Enter bir sonraki
  maddeyi başlatır, boş maddede Enter listeden çıkar. Renk etiketi, sabitleme, oluşturma/düzenleme zamanı, sözcük ve görev
  sayısı alt bilgide. Yazdıkça kaydedilir (`notebook` anahtarı); boş bırakılan yeni not başka nota geçince silinir.
  `Ctrl+N` panelde yeni not açar. Komut paletinde (**Ctrl+K**) "Yeni not" eylemi ve tüm notlar (başlık + içerikte arama).
- **Pano geçmişi paneli**: kopyalanan metinler (son 100) listelenir; tıklayınca panoya geri kopyalanır. Arama, sabitleme
  (sabitliler taşmada ve "Temizle"de silinmez), silme, adresse tarayıcı sekmesinde açma, **not olarak kaydetme**, kaydı
  duraklatma. Parola yöneticilerinin gizli işaretlediği içerik (`ExcludeClipboardContentFromMonitorProcessing`,
  `Clipboard Viewer Ignore`, `CanIncludeInClipboardHistory = 0`) ve 20 KB'tan büyük metinler kaydedilmez. Yalnızca metin
  (resim/dosya yok). Kayıtlar `clipboard.json` dosyasında, yalnızca bu bilgisayarda.
- **Alışkanlıklar** widget'ı: günlük işaretleme (büyük onay düğmesi), güncel seri (bugün işaretlenmediyse dünden sayılır),
  en uzun seri, son 7 gün noktaları (geçmiş günler tıklanarak düzeltilebilir; gelecek gün işaretlenemez).
- **Geri sayım** widget'ı: "Maaş günü" (her ay), "Doğum günü" (her yıl), "Bayram" (bir kez) gibi tarihlere kalan gün;
  en yakını büyük gösterilir. Ayın son gününü aşan tarihler o ayın son gününe kayar (31 → 30 Kasım).
- **Döviz çevirici** widget'ı: TL ve Piyasalar panelinde izlenen para birimleri arasında çeviri; yalnızca TCMB
  gösterge kurları kullanılır ve **Referans** etiketiyle bülten zamanı gösterilir (piyasa/demo verisi karışmaz). Kur
  yoksa rakam gösterilmez. Tutar Türkçe (`1.250,50`) veya İngilizce (`1,250.50`) yazılabilir.
- **Not defteri** widget'ı: hızlı yakalama kutusu (Ctrl+Enter → Notlar paneline yeni not) ve son/sabitli notlar
  (tıklanınca Notlar paneli o notla açılır).
- Yeni hazır çalışma alanı düzenleri: Genel'e Alışkanlıklar + Geri sayım, Çalışma'ya Not defteri, Haberler ve finans'a
  Döviz çevirici eklendi (yalnızca yeni kurulumlarda veya "varsayılana döndür"de; kayıtlı düzenler değişmez).

## Görünüm (v0.4 "Aurora")

Koyu zemin üstünde hafif mor/turkuaz/pembe ışık, buzlu cam paneller (`glass`), yüzen kenar dock'u (fareyle üstüne gelince
panel adı), mor→camgöbeği degrade vurgular, 24px panel köşeleri ve degrade saat. Performans modunda cam bulanıklığı
kapanır ve paneller opak olur. Ayrıntı: `docs/design-system.md` bölüm 0.

Okunabilirlik kuralları (v0.3): 14px taban metin, en küçük metin 12px, çerçeve yerine yüzey, 12px boşluklar. Üst çubukta yalnızca çalışma alanları,
saat ve arama/hızlı ayarlar/tam ekran kalır.
Panel başlığındaki ayır/kapat düğmeleri fareyle üzerine gelince görünür. İkiden fazla panel satırı olduğunda her satır
en az yarım ekran yüksekliğindedir ve ana alan kaydırılır.

## Yeni (v0.2): tam ekran masaüstü merkezi

### Tam ekran ve ikinci monitör
- **Kenarlıksız tam ekran** (Windows "borderless fullscreen"; çözünürlük değişmez, Alt+Tab ve diğer monitör normal çalışır)
- Hedef monitör: **Otomatik** (ikinci ekran, yoksa birincil) veya listeden belirli bir monitör; monitör haritası,
  çözünürlük ve ölçek (%DPI) gösterilir. "Hedef ekrana taşı" ile yanlış ekranda açılan pencere taşınır.
- Tercih `layout.json`'da saklanır ve **webview yüklenmeden** uygulanır; monitör takılıp çıkarılınca (2 sn'de bir denetim)
  tam ekran doğru monitöre yeniden uygulanır.
- Tam ekranda pencere düğmeleri ve sürükleme kapanır; üst çubukta "Tam ekrandan çık" ve "Gizle" bulunur.
- **Sistem çapında kısayollar** (uygulama gizliyken de; Win32 `RegisterHotKey`, ayarlardan değiştirilebilir/kapatılabilir):
  `Ctrl+Alt+Space` göster/gizle, `Ctrl+Alt+F` tam ekran, `Ctrl+Alt+K` komut paleti. Başka program aynı kısayolu
  tutuyorsa ayarlarda hata gösterilir. Uygulama içinde: `F11`, `Ctrl+K`, `Ctrl+1…9` (çalışma alanı).
- Başlangıç: **Windows açılınca başlat** (HKCU\…\Run), **tepside başlat**; tepsi menüsünde göster/gizle ve tam ekran.

### Ana ekran ve widget'lar
- 12 sütunlu ızgara: widget **ekle / kaldır / sürükle / boyutlandır / sabitle / devre dışı bırak**; çakışmalar otomatik
  çözülür, boşluklar sıkıştırılır (saf fonksiyonlar, birim testli). Dar panelde tek sütuna döner.
- Widget'lar: Saat ve tarih, Hava durumu (Open-Meteo, anahtarsız), Notlar, Yapılacaklar, Odaklanma sayacı (Pomodoro),
  Sistem kaynakları (CPU/RAM/disk), Favori uygulamalar, Haber başlıkları, Kurlar ve takip listesi (veri türü etiketli),
  Müzik denetimi, Sabitlenmiş pencereler. Her biri ayrı bileşen; kendi ayarı ve hata sınırı vardır.
- Pencere gizliyken/simge durumundayken widget yenilemeleri durur.

### Çalışma alanları ve kişiselleştirme
- Hazır çalışma alanları: **Genel, Çalışma, Haberler ve finans, Müzik ve eğlence**. Her birinin kendi panelleri, panel
  genişlikleri (paneller arası ayırıcı sürüklenir) ve widget düzeni vardır. Kopyalama, yeniden adlandırma, silme,
  varsayılana dönme, açılışta kullanılacak çalışma alanı. Önceki sürümün düzeni "Genel"e taşınır.
- **Komut paleti (Ctrl+K)**: panel, çalışma alanı, widget ekleme, uygulama başlatma, yer imi açma, eylemler.
- **Hızlı ayarlar**: tema, ekran modu/monitör, bu çalışma alanının panelleri, performans modu.
- **Mini kontrol merkezi** (üst çubuk): saat/tarih, CPU/RAM, çalan medya.
- **Performans modu**: seyrek yenileme, animasyon yok, saniyesiz saat.
- **Akıllı kısayollar**: uygulama zaten açıksa yeni örnek yerine penceresi öne getirilir.

### Tarayıcı paneli (sekmeler + bölünmüş görünüm)
- Her sekme ayrı bir WebView2 (Chromium) alt penceresidir; profil kalıcıdır (`%LOCALAPPDATA%\com.alperen.alpicim\browser`).
- Sekme şeridi: site simgesi, başlık, yükleniyor göstergesi, × ile ya da **orta tıkla** kapatma, **+** ile yeni sekme,
  sürükleyerek sıralama. En fazla 12 sekme. Yeni sekme başlangıç sayfasıyla (arama + yer imleri) açılır.
- Sayfanın `target=_blank` / `window.open` ile açtığı bağlantılar uygulama içinde **yeni sekmede** açılır.
- **Görünüm**: Tek / Yan yana / Alt alta. Bölünmüş görünümde iki bölme ayrı sekme gösterir; aradaki ince ayırıcı
  sürüklenerek boyutlandırılır (çift tık: eşitle, oran kaydedilir). Odaklı bölme vurgu renkli çerçeveyle gösterilir;
  adres çubuğu ve geri/ileri/yenile odaklı bölmeye uygulanır. Bölmenin başlığına tıklamak onu odaklar; sekme şeridinde
  bir sekmeye tıklamak onu odaklı bölmede gösterir (diğer bölmede açıksa o bölmeyi odaklar).
- Açık sekmeler, başlıklar, etkin sekmeler, görünüm ve oran kaydedilir; yeniden açılışta yalnızca **görünen** sekmeler
  yüklenir, diğerleri ilk gösterildiklerinde açılır.
- Kısayollar (odak Alpicim arayüzündeyken): `Ctrl+T` yeni sekme, `Ctrl+W` sekmeyi kapat, `Ctrl+Tab` / `Ctrl+Shift+Tab`
  sekmeler arası geçiş, `Ctrl+L` adres çubuğu.
- Komut paletinden açılan adresler yeni sekmede (etkin sekme boş başlangıç sayfasıysa orada) açılır.
- Araç çubuğundaki **kalkan**: bu sayfada engellenen istek sayısı; tıklayınca reklam engelleme yalnızca bu site için
  kapatılır/açılır ve sayfa yenilenir. Reklam engelleyici kapalıysa ya da hazır değilse kalkan pasif/gizlidir.

### YouTube Music paneli
- Resmî `https://music.youtube.com/` arayüzü gömülü WebView2'de; profil tarayıcı paneliyle ortak ve **kalıcı**
  (`%LOCALAPPDATA%\com.alperen.alpicim\browser`), bu yüzden her açılışta tekrar giriş gerekmez.
- Uygulama genelinde tek örnek: panel ayrı pencereye taşınınca webview taşınır, çalma kesilmez.
- Panel kapatılınca: ayara göre **çalmaya devam** (gizlenir) veya **durur** (kapatılır).
- Oynat/duraklat/önceki/sonraki ve parça bilgisi **Windows medya oturumu (SMTC)** üzerinden; sayfaya betik enjekte edilmez.
  Sessize alma WebView2'nin resmî `IsMuted` özelliğiyle. Ses seviyesi ayarı YouTube Music'in kendi arayüzündedir.
- YouTube/Google dışındaki bağlantılar sistem tarayıcısında açılır; "Tarayıcıda aç" her zaman mevcuttur.

### Pencereler paneli (açık Windows uygulamalarını panele alma — deneysel)
- "Açık pencere ekle": görev çubuğundaki türden pencereler başlık + uygulama adıyla listelenir; gömülemeyenlerin
  nedeni gösterilir. "Tıklayarak seç": düğmeden sonra 15 sn içinde tıklanan pencere alınır.
- Gerçek pencere `SetParent` + stil değişikliğiyle, Alpicim'in ayrı bir iş parçacığına ait kenarlıksız bir
  **kapsayıcı pencereye** alınır; kapsayıcı ana pencerenin hemen üstünde panelin konumunda tutulur (taşıma, boyutlandırma,
  tam ekran, simge durumu, gizleme ve öne gelme izlenir). Sekmeler arasında geçilir, klavye odağı verilir.
  "Panelden çıkar" pencereyi **eski konumuna, boyutuna ve stillerine** döndürür.
  *Neden doğrudan Alpicim penceresine değil?* Uygulama içi testte iki sorun görüldü: WebView2 (DirectComposition)
  klasik GDI pencerelerini örtüyordu (Karakter Eşlem görünmüyordu) ve gömülü Discord, WebView2 ile aynı giriş
  kuyruğunu paylaşınca Alpicim'e fare girdisi ulaşmıyordu. Kapsayıcı mimarisi ikisini de çözdü.
- Uygulama yeniden açıldığında kayıtlı pencereler **otomatik gömülmez**; sekme "Panele yerleştir" düğmesiyle onay bekler.
- Gömülemeyenler (yönetici olarak çalışan, sistem/kabuk, UWP ve Microsoft Store uygulamaları) **kart** olarak eklenir:
  "Öne getir" düğmesiyle kullanılır. Özellik ayarlardan kapatılabilir; kapalıyken hiçbir pencereye dokunulmaz.
- Panel gizlenince, çalışma alanı değişince, panel penceresi kapanınca, uygulamadan çıkınca ve Rust panik durumunda
  pencereler bağımsız hâle getirilir. Panel tekrar açılınca aynı oturumdaki pencereler yeniden yerleştirilir.
- DLL/kod enjeksiyonu yoktur; yalnızca belgelenmiş Win32 pencere API'leri kullanılır.

**Uyumluluk (bu makinede doğrulanan):**

| Uygulama | Sonuç |
|---|---|
| Karakter Eşlem (klasik Win32) | ✅ otomatik test + **uygulama içinde**: picker'dan yerleştir, tıklama, tam ekranda konum takibi, gizle/göster, katman açıkken gizlenme, panelden çıkar ve çalışma alanı değişince otomatik serbest bırakma (özgün stil/boyut geri geldi) |
| Microsoft Edge (Chromium, ayrı geçici profil) | ✅ otomatik test (kapsayıcı mimarisiyle) |
| Discord | ✅ **uygulama içinde, kapsayıcı mimarisiyle**: fare (tıklama), klavye (Ctrl+K hızlı geçiş + metin yazma), Alpicim'in tıklamalara yanıt vermeye devam etmesi, tam ekrana giriş/çıkışta boyut takibi, gizle/göster kısayoluyla birlikte gizlenip geri gelme, aynı oturumda panel yeniden açılınca otomatik yerleşme, panelden çıkarma. (Eski, kapsayıcısız sürümde fare girdisini kilitliyordu.) |
| Windows 11 Not Defteri (Store/WinUI) | ❌ gömülünce kendi penceresini kapatıyor → reddediliyor, pencereye dokunulmuyor |
| Görev çubuğu vb. sistem pencereleri | ❌ reddediliyor, değiştirilmiyor |
| Spotify, Chrome | **Test edilmedi** |

Testler: `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture --test-threads=1`
(ekranda pencere açar; açık Not Defteri belgeleriniz varsa çalıştırmadan önce kapatın).

---

## Kurulum (Windows 10/11)

1. **Node.js 22 LTS** (20+ çalışır): <https://nodejs.org>
2. **Rust** (stable, MSVC): <https://rustup.rs> → `rustup-init.exe`, varsayılan seçenekler
3. **Visual Studio C++ Build Tools**: <https://visualstudio.microsoft.com/visual-cpp-build-tools/> →
   "C++ ile masaüstü geliştirme" iş yükü
4. **WebView2**: Windows 11'de hazır gelir; Windows 10'da gerekirse <https://developer.microsoft.com/microsoft-edge/webview2/>

Ayrıntılı ön koşullar: <https://v2.tauri.app/start/prerequisites/>

Bu bilgisayarda bu araçlar `scripts\setup-prereqs.cmd` ile kuruldu (Node.js taşınabilir zip + SHA256 doğrulaması,
rustup, winget ile Build Tools). Başka bir makinede de aynı betiği çalıştırabilirsiniz.

```powershell
cd $HOME\Documents\Alpicim
npm install
```

### Yardımcı betikler (`scripts\`, çift tıklanarak çalışır)

| Betik | Ne yapar |
|---|---|
| `setup-prereqs.cmd` | Node.js, Rust ve VS C++ Build Tools'u kurar → `logs\setup.log` |
| `verify.cmd` | Ortamı denetler, tüm kontrolleri çalıştırır → `logs\verify-summary.txt` |
| `dev.cmd` | Uygulamayı geliştirici modunda açar |
| `build.cmd` / `build-clean.cmd` | Kurulum paketlerini üretir (temiz derleme) → `logs\build.log` |
| `stop-app.cmd` | Takılan Alpicim süreçlerini kapatır |
| `nettest.cmd` | Veri kaynaklarına erişimi test eder → `logs\nettest.txt` |

## Geliştirme

```powershell
npm run tauri dev        # uygulamayı geliştirici modunda açar (ilk Rust derlemesi birkaç dakika sürer)
```

veya `scripts\dev.cmd` dosyasına çift tıklayın.

Kontroller:

```powershell
npm run typecheck        # TypeScript (strict)
npm run lint             # ESLint
npm test                 # Vitest birim testleri
npm run check:rust       # cargo check + cargo test
npm run verify           # hepsi
```

`scripts\verify.cmd` ortamı (Node, Rust, MSVC, WebView2) denetler, bağımlılıkları kurar, tüm kontrolleri çalıştırır ve
sonucu `logs\verify-summary.txt` dosyasına yazar.

Yalnızca arayüz üzerinde çalışmak için `npm run dev` ile tarayıcıda açabilirsiniz (http://localhost:1420,
tek panel için `?panel=news`). Bu modda Rust komutları olmadığı için başlatıcı ve anahtar yönetimi "masaüstü gerekli"
durumunu gösterir; haber/kur istekleri tarayıcının CORS kuralı nedeniyle çoğunlukla çalışmaz.

## Kendi anahtarlarınızla kurulum

Depoda hiçbir API anahtarı, kişisel yol, şehir ya da hesap bilgisi yoktur. Depoyu klonlayan her kullanıcı
**Ayarlar → Entegrasyonlar** bölümünde:

- anahtarsız hizmetleri (gizlilik için) tek tek **kapatabilir** — kapalı bir hizmete hiç istek gönderilmez, ilgili
  özellik "devre dışı — Ayarlar → Entegrasyonlar" durumunu gösterir;
- anahtar isteyen hizmetler için **kendi anahtarını** girip **Kaydet** der; isterse **Test et** ile tek bir deneme isteği
  gönderir. Anahtar girilene kadar bu hizmetler hiç kullanılmaz.

| Entegrasyon | Kategori | Ne için | Anahtar | Nereden alınır | Kapalıyken |
|---|---|---|---|---|---|
| TCMB `today.xml` | Piyasa | Gösterge kurlar (piyasalar, alt şerit, kur widget'ları) | Hayır | — | Referans kurlar bölümü "devre dışı" |
| Frankfurter | Piyasa | Günlük kur grafikleri | Hayır | — | Grafik yok |
| Twelve Data | Piyasa | Piyasa fiyatı, ons/gram altın, izleme listesi | **Evet** | <https://twelvedata.com/pricing> (ücretsiz plan) | Bölüm "devre dışı", eski fiyatlar silinir |
| Open-Meteo | Hava | Hava durumu widget'ı (varsayılan), şehir arama | Hayır | — | Widget "devre dışı" |
| OpenWeatherMap | Hava | Hava durumu widget'ı (widget ayarında kaynak seçilirse) | **Evet** | <https://home.openweathermap.org/users/sign_up> (ücretsiz plan; yeni anahtarın etkinleşmesi birkaç saat sürebilir) | Widget "devre dışı" |
| Google Haberler RSS | Haber | Yerleşik Türkçe haber akışları | Hayır | — | Yalnızca kendi eklediğiniz RSS kaynakları |
| Google site simgeleri | Tarayıcı | Sekme, yer imi ve bağlantı simgeleri | Hayır | — | Baş harf gösterilir; alan adları Google'a gitmez |
| Reklam engelleme listeleri | Tarayıcı | AdGuard / EasyPrivacy / uBlock listeleri | Hayır | — | Kendi bölümünden (Ayarlar → Reklam engelleyici) yönetilir |
| YouTube Music | Medya | Müzik paneli ve mini oynatıcı | Hayır (kendi Google hesabınız) | — | Yalnızca panel açılınca yüklenir |

Kendi eklediğiniz RSS kaynakları ve tarayıcıda açtığınız siteler entegrasyon sayılmaz; onları zaten siz seçersiniz.

**Anahtar nerede saklanır?** Windows **Kimlik Bilgisi Yöneticisi**'nde (Denetim Masası → Kimlik Bilgisi Yöneticisi →
Windows Kimlik Bilgileri → `com.alperen.alpicim` / sağlayıcı kimliği). Dosyaya, depoya, `.env`'e veya derlenen
JavaScript'e yazılmaz; arayüze geri gönderilmez (arayüz yalnızca "kayıtlı mı?" bilgisini görür).

**Anahtar nasıl gönderilir?** Yalnızca Rust tarafında, `src-tauri/src/providers.rs` tablosuna göre ve yalnızca
sağlayıcının kendi sunucusuna (https, varsayılan bağlantı noktası) eklenir; anahtarlı isteklerde yönlendirme izlenmez ve
hata mesajlarına adres yazılmaz:

| Sağlayıcı kimliği | Sunucu | Biçim |
|---|---|---|
| `twelvedata` | `api.twelvedata.com` | `Authorization: apikey …` başlığı |
| `openweathermap` | `api.openweathermap.org` | `appid=…` sorgu parametresi (sağlayıcı başlık desteklemiyor) |

Yeni anahtarlı sağlayıcı eklerken: `providers.rs::PROVIDERS` + `src/modules/integrations/registry.ts` kaydı + `tr.ts` metinleri.

*Sınır:* Aynı Windows kullanıcısıyla çalışan başka programlar Kimlik Bilgisi Yöneticisi'ni okuyabilir; bu, işletim
sisteminin kullanıcı düzeyindeki korumasıdır.

### Twelve Data anahtarı

1. <https://twelvedata.com> adresinde ücretsiz hesap açın, panelden API anahtarını kopyalayın.
2. Alpicim → **Ayarlar → Entegrasyonlar → Twelve Data** → anahtarı yapıştırıp **Kaydet** (isteğe bağlı **Test et**).
3. Piyasalar paneli otomatik olarak piyasa fiyatlarını getirir.

**İstek sınırı:** Uygulama Twelve Data'ya dakikada en fazla 8 istek gönderir (ücretsiz plan için temkinli varsayılan) ve
piyasa yenileme aralığı en az 60 sn'dir. Her yenilemede yaklaşık *(izlenen kur sayısı (en fazla 3) + 1 altın + izleme
listesi)* kredi harcanır. Güncel plan sınırınızı Twelve Data panelinden kontrol edin.

**BIST hisseleri:** Desteklendiği varsayılmaz. İzleme listesine örn. `THYAO` + borsa `XIST` girin; uygulama sembolü
sağlayıcıya sorar. Planınız bu borsayı kapsamıyorsa sağlayıcının mesajı aynen gösterilir ve sembol eklenmez.

### Haber kaynakları

Haber panelindeki **RSS** düğmesi → kaynak ekle/kaldır/aç-kapat. Eklenen her akış önce indirilip doğrulanır.
Uygulama haber metinlerini kopyalamaz; yalnızca akışın yayımladığı başlık, kısa açıklama ve bağlantıyı gösterir.
Kaynağın kullanım koşullarına uymak kullanıcının sorumluluğundadır.

## Windows kurulum paketi

```powershell
npm run tauri build
```

Çıktılar:
- `src-tauri\target\release\bundle\nsis\Alpicim_0.1.0_x64-setup.exe` (Türkçe kurulum sihirbazı)
- `src-tauri\target\release\bundle\msi\Alpicim_0.1.0_x64_en-US.msi`

Paket imzasızdır; ilk çalıştırmada Windows SmartScreen uyarısı görülebilir. Kod imzalama için:
<https://v2.tauri.app/distribute/sign/windows/>

## Veriler nerede?

`%APPDATA%\com.alperen.alpicim\`
- `alpicim.json` — ayarlar, haber kaynakları, yer imleri, okunanlar, izleme listesi, önbellek
- `layout.json` — pencere konum/boyutları, ayrılmış paneller, üstte tutma
- `launcher.json` — uygulama kısayolları
- `alpicim.json` içinde ayrıca: `workspaces` (çalışma alanları, widget'lar, not/yapılacaklar içerikleri), `apps.tabs`
  (sabitlenmiş pencereler: başlık + exe yolu), `weather.cache`
- `alpicim.json` → `notebook`: Notlar paneli (Not defteri widget'ı da buraya yazar)
- `clipboard.json` — pano geçmişi (metin kayıtları, sabitleme, duraklatma durumu)
- `layout.json` içinde ayrıca: ekran modu/hedef monitör, kısayollar, tepside başlatma
- `%LOCALAPPDATA%\com.alperen.alpicim\browser` — tarayıcı ve YouTube Music oturumları (çerezler)

Sıfırlamak için uygulamayı kapatıp bu klasörü silin.

## Bilinen sınırlar (v0.1)

- Tarama yalnızca Başlat menüsü ve masaüstü kısayollarını okur; kısayolu olmayan taşınabilir .exe'ler elle eklenmelidir.
- TCMB kurları gösterge niteliğindedir; hafta sonu ve tatillerde son bülten gösterilir.
- Gram altın, ons fiyatı ve kurdan hesaplanır; kuyumcu/banka satış fiyatı değildir.
- Ücretsiz Twelve Data planında bazı semboller/borsalar kapalı olabilir veya veri gecikmeli olabilir.
- OpenWeatherMap kaynağı birim testleriyle doğrulandı; gerçek bir anahtarla uygulama içinde henüz denenmedi.
- YouTube Music ve reklam engelleme listeleri Entegrasyonlar'da yalnızca listelenir (açma/kapama kendi panel/bölümünden).
- Bazı resmî sunuculara (ör. TCMB) ilk bağlantı bu ağda ~9 sn sürüyor; ilk açılışta kurların gelmesi birkaç saniye gecikebilir.
- Release profilinde `lto`, `panic = "abort"` ve `strip` kapalı: Rust 1.99 + Windows'ta proc-macro yükleme hatasına (E0463) yol açıyordu. Paket yine küçük (~1,7 MB kurulum).
- Pencere geometrisi fiziksel piksel olarak saklanır; farklı ölçekli monitörler arasında taşınan pencere geri
  yüklenirken boyutu ölçek farkı kadar değişebilir.
- **Pencere gömme riski:** Alpicim zorla sonlandırılırsa (Görev Yöneticisi, elektrik kesintisi) Windows alt pencereleri
  ebeveynle birlikte yok eder; gömülü uygulamanın penceresi kapanabilir (test sırasında Not Defteri ile görüldü).
  Kaydedilmemiş işi olan uygulamaları gömmeyin. Gömülü pencereler Alt+Tab'da görünmez; DPI farkı olan uygulamalar
  bulanık/yanlış ölçekli görünebilir; açılır menüler/iletişim kutuları ayrı pencere olarak açılır.
- Gerçek bir Windows penceresini panele **sürükle-bırakla** almak desteklenmiyor; liste ve "tıklayarak seç" kullanılır.
- **Odak** düzeninde başka sekmeye geçmek Pencereler panelini kaldırır; gömülü uygulamalar o sırada masaüstüne döner ve
  sekmeye dönünce (aynı oturumda) otomatik yeniden yerleşir. (Not: sahne düzeninde sekmeler arasında geçmek pencereleri artık çıkarmaz; bu yalnızca sekme kapatılınca olur.)
- Gömülü Discord kendi başlık çubuğunu (küçült/büyüt/kapat) çizmeye devam eder; oradaki "kapat" Discord'u tepsiye gizler
  ve panel boş görünür. Pencereyi panelden çıkarmak için Alpicim'in "Panelden çıkar" düğmesini kullanın.
- Gömülü pencere odaktayken Alpicim'in uygulama içi kısayolları (F11, Ctrl+K) o uygulamaya gider; sistem çapındaki
  kısayollar (Ctrl+Alt+F, Ctrl+Alt+K, göster/gizle) çalışmaya devam eder.
- YouTube Music: Google girişinin gömülü WebView2'de kabul edilip edilmediği **denenmedi** (hesap bilgisi girilmedi).
  Engellenirse "Tarayıcıda aç" kullanılır. Oturum açmadan oynatma, parça bilgisi (SMTC), oynat/duraklat/sonraki,
  sessize alma ve panel gizliyken çalmaya devam uygulama içinde doğrulandı.
- WebView2 medya oturumu Windows'a `msedgewebview2` kimliğiyle bildirilir; Alpicim bunu kendi oturumu sayar. Başka bir
  WebView2 uygulaması da medya çalıyorsa denetimler onu hedefleyebilir.
- Ses seviyesi kaydırıcısı yok (WebView2'nin ses seviyesi API'si yok); yalnızca sessize alma.
- **Reklam engelleyici** (tarayıcı + YouTube Music; Brave `adblock` motoru, AdGuard Temel/Türkçe, EasyPrivacy,
  uBlock filtreleri): ağ engelleme ve CSS gizleme yapılır, ancak uBlock/AdGuard'ın **betik enjeksiyonu
  (`+js(...)`/scriptlet), yönlendirme kaynakları (`$redirect` → boş yanıt olarak engellenir) ve prosedürel seçiciler
  (`:has-text`, `:upward` …) desteklenmez**; bunlara dayanan reklamlar ve "reklam engelleyici kapatın" uyarıları
  görünebilir. Görünüm süzme yalnızca üst çerçevede ve sayfa yüklenirken/yüklendiğinde iki tur çalışır; sonradan
  eklenen genel (`##.sınıf`) reklam kutuları gizlenmeyebilir (alana özgü kurallar her zaman geçerlidir).
  YouTube'daki video reklamları yerleşik bir betikle (oynatıcı yanıtından reklam alanlarını budama + görünen reklamı
  atlama) engellenir; YouTube değişiklik yaptıkça kısa reklam ya da siyah ekran görülebilir. Webview oluşturulduktan
  hemen sonra bağlandığı için ilk sayfanın en erken birkaç isteği süzgeçten kaçabilir. Uygulama içi canlı deneme
  (`tauri dev`) henüz yapılmadı; yalnızca birim testleri ve gerçek listelerle motor testi (`real_lists`, yok sayılan test).
- Varsayılan göster/gizle kısayolu `Ctrl+Alt+Space` bu makinede başka bir program tarafından tutuluyordu (ayarlarda
  uyarı olarak görünür); test sırasında `Ctrl+Alt+H` olarak değiştirildi.
- Windows Uygulama Denetimi (Smart App Control) açıkken yeni derlenen imzasız `alpicim.exe` engellenir; geliştirme için
  kullanıcının bu ayarı yönetmesi gerekir.
- Çalışma alanlarından önceki sürümün tek düzen kaydı (`layout.main`) artık okunmaz; o sürümden doğrudan güncellenirse
  paneller varsayılan çalışma alanlarıyla açılır.
- **Tarayıcı sekmeleri**: sekme ve bölünmüş görünüm yalnızca birim testleri ve tip denetimiyle doğrulandı; uygulama içinde
  (`tauri dev`) henüz elle denenmedi. Yerel webview içine tıklamak odaklı bölmeyi değiştirmez (WebView2 alt penceresinin
  tıklaması HTML'e ulaşmaz): bölme başlığına ya da sekmeye tıklayın. Sayfa içindeyken basılan `Ctrl+T/W/Tab/L` sayfaya
  gider. Açılır pencereyle (`window.open` + `opener`) çalışan giriş akışları yeni sekmede açıldığı için bozulabilir;
  "Chrome'da aç" kullanın. Site simgeleri Google'ın simge hizmetinden alınır.
- Piyasa fiyatları yalnızca pencere görünürken, ana ekran widget'ları ayrıca ana ekran etkin sekmedeyken periyodik
  yenilenir; görünür olunca bayat veriler hemen tazelenir. Haberler arka planda da yenilenmeye devam eder.
- **Pano geçmişi**: yalnızca birim testleri (`clipboard::tests`) ve `cargo check` ile doğrulandı; dinleyici iş parçacığı,
  panoya geri yazma ve parola yöneticisi işaretleri uygulama içinde (`tauri dev`) **henüz elle denenmedi**. Yalnızca
  metin (CF_UNICODETEXT) kaydedilir; zengin metin biçimi, resim ve dosyalar kaydedilmez. Kayıtlar düz JSON olarak
  diskte durur (şifrelenmez); hassas bir şey kopyalandıysa kaydı silin veya kaydı duraklatın. Tarayıcı önizlemesinde
  (`npm run dev`) panel "masaüstü uygulaması gerekli" durumunu gösterir.
- **Notlar / yeni widget'lar**: Vite önizlemesinde elle denendi (not oluşturma, Markdown önizleme, görev kutusu,
  liste devamı, paletten not açma, alışkanlık işaretleme ve seri, geri sayım ekleme, örnek kurla çevirici, hızlı not);
  Tauri penceresinde ve ayrı panel penceresinde henüz denenmedi. Aynı not iki pencerede aynı anda düzenlenirse son
  kaydeden kazanır. Markdown desteği bilinçli olarak küçüktür (tablo, resim, iç içe alıntı yok).
- Laila, yerel pencerelerin (tarayıcı, YouTube Music, gömülü uygulamalar) altında çizilir; bu pencereler açıkken arkasında kalır.
- Laila'nın sohbet yanıtları yalnızca anahtar kelimelere göre seçilir; yapay zekâ veya internet bağlantısı yoktur.

## Proje yapısı

Bkz. [`CLAUDE.md`](CLAUDE.md) (mimari ve kurallar) ve [`docs/implementation-plan.md`](docs/implementation-plan.md).
