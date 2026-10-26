/** Türkçe 5 harfli sözcükler (küçük harf). Günün sözcüğü ANSWERS içinden seçilir; tahminler ANSWERS + EXTRA içinde aranır. */

const ANSWER_TEXT = `
  akşam altın aslan atlas ayran ahlak aktif alkol anlam armut arsız artık asker bahçe balık bakır balon banka
  barış baskı bebek belge benek beyaz bilek bilgi bitki bölge boyun bozuk bulut burun buzul çanta çatal çavuş
  çekiç çelik çevre çiçek çizgi çizme çocuk çorap çorba çukur çürük dalga damar damla defne deniz derin deste
  dikiş dilek doğru dolap dolar domuz dudak duman durum duvar düğme düğün dünya düzen ekmek elmas emlak engel
  erken erzak esmer evcil evren fakir fayda fidan fikir firma forma garaj gelir giriş görev görüş gönül gümüş
  güneş gurur güven güzel hafta hamur hasta hayal hayat hazır heves hücre huzur hıyar iklim iplik istek jeton
  kabak kabuk kadın kağıt kahve kalem kalın kanat kapak karar kasım kaşık kavga kavun kayık kazak kemik kenar
  kesin keten kılıç kısım kitap klima kolay konak korku kozak kömür köpek köprü kumaş kurak kuşak kutup kuzey
  küçük kürek lamba lider limon liste makas masal melek merak mutlu nakit namus nefes nokta nüfus olgun orman
  örnek özlem özgür pamuk parça parti pasta pazar perde petek plaka posta radyo rakam rakip rahat rapor resim
  sabah sabun sahil sakal salon saman sanat saray sayfa sepet sokak sonuç soğuk sorun sütun şafak şahin şapka
  şarkı şarap şehir şeker şifre tabak taban tahta takım talep tamam tarif tarla tavuk tavan temiz tilki tohum
  tuğla tuzak tünel uygun vagon vahşi vakit vapur vatan yakın yalan yarım yarış yaşam yatak yavru yayın yazar
  yedek yeşil yenik yetki yılan yıkık yumuk yüzük zafer zaman zarar zemin zihin bilet cadde canlı cevap cemre
  çadır çınar dizin dolma dönem dürüm eylem fener fırın fırça gelin genel gölge göğüs gülüş hamam hepsi kafes
  kalıp kanun karne kasap kaset katil kazan kebap kiraz kilim kirli kitle koyun kural liman lokum maden marul
  minik misal nazar nehir nesil nesne niyet oğlak paket parke pınar salça satış selam serin sıcak sınav sınır
  sivri sofra soğan sonra tahıl tarih tatil tavır tepsi terzi tıpkı tokat tören torba üçgen ürkek vergi yasak
  yazın yelek yemin yüzde zerre zehir
`;

const EXTRA_TEXT = `
  acemi adres ahize aidat alaca alçak alıcı alkış altar anket anons antik arıza arşiv aşırı aylak bakım bakla
  balta bando baraj baret barut basın başka bayan bekar bekçi beden bence beton bıçak bilye bingo bitiş bodur
  bohça boğaz bölük bulgu cahil cazip cesur cihaz cimri çabuk çağrı çakıl çalgı çarşı çekme çelme çıkış çıkar
  çıban çırak çilek çinko çoban çözüm dağlı dakik dalak damga darbe davet davul dayak dekan delik demir denge
  desen dikey dilim direk divan doğal dokuz dönüm duygu dümen düşük düşey eksen eleme evrak eyvah fazla ferah
  fiyat folyo fosil galip garip gayet gazoz gizem gövde gübre güney haber hacim hakem halka hamle havuç havza
  hayır heyet hırka hilal hitap hurda ibret iddia idare ihale ikili ilkel inkar insan irade itaat kabul kafir
  kaide kakao kalça kanıt kavak kayak kaygı kekik kesik kimya konuk kopuk kovan kulak kumar kuruş kusur lazım
  lehçe levha likit macun makam malik manav mazot mekan mesaj mesai metin metal mısra mimar model motor ayrıt
  bacak bağış bağlı basit bayat belki bırak bilim birey bitim boğuk bukle cümle çarpı çıkın dalda dolgu duyum
  eğlen gıpta gülüm hasat hayli ikram kabin kadro kalay kamış kampa kanca karga karma kavis kıyma kıran kızıl
  kocak kolon kutlu lakap latif lehim mahir makul maske masum matem medar meşru nadir nakış nazlı nemli nesir
  niyaz pilot rahim raket rampa ritim salgı sanık sapan sebil seçim sekiz sürat talih talim tasma yağız yağlı
  yanak yanık yankı yapay yarar yığın yoğun yorum yumak yunus zabıt zayıf zebra zırva zorlu
`;

const split = (s: string) => s.split(/\s+/).filter(Boolean);

export const ANSWERS: readonly string[] = split(ANSWER_TEXT);
export const VALID_EXTRA: readonly string[] = split(EXTRA_TEXT);
