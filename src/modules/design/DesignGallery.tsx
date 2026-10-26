import {
  AppWindow,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cloud,
  CloudSun,
  Copy,
  Inbox,
  LayoutDashboard,
  Moon,
  Music2,
  Newspaper,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  SkipForward,
  Sun,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Menu, Dialog, Tooltip } from '../../shared/ui/overlays';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  List,
  ListItem,
  Segmented,
  Select,
  Tabs,
  TextInput,
  Toggle,
  Toolbar,
  ToolbarSeparator,
  cx,
} from '../../shared/ui/primitives';
import { useToast } from '../../shared/ui/Toast';

/* Tasarım galerisi (docs/dev/redesign-v1.md): geliştirici sayfası, ?panel=__design. Metinler bilerek yerel (kullanıcı arayüzü değil). */

type Mode = 'dark' | 'light';

export function DesignGallery() {
  const [mode, setMode] = useState<Mode>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <div className="selectable flex h-full flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-stroke bg-layer px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-xl font-semibold">Alpicim tasarım galerisi</h1>
          <span className="text-sm text-fg-3">v1.0 belirteçleri ve bileşenleri</span>
        </div>
        <Segmented
          label="Tema"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'dark', label: 'Koyu', icon: Moon },
            { value: 'light', label: 'Açık', icon: Sun },
          ]}
        />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-12 px-6 py-8">
          <Palette />
          <TypeScale />
          <Components />
          <Compositions />
        </div>
      </main>
    </div>
  );
}

function Section({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {note && <p className="mt-1 text-sm text-fg-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">{children}</p>;
}

/* ───────────── Palet ───────────── */

const SWATCHES: ReadonlyArray<{ name: string; v: string; use: string }> = [
  { name: '--bg', v: 'bg', use: 'pencere zemini' },
  { name: '--layer-1', v: 'layer-1', use: 'kenar çubuğu, durum çubuğu' },
  { name: '--card', v: 'card', use: 'kart yüzeyi' },
  { name: '--card-hover', v: 'card-hover', use: 'kart üzerinde' },
  { name: '--control', v: 'control', use: 'düğme, girdi' },
  { name: '--accent', v: 'accent', use: 'tek vurgu' },
  { name: '--accent-soft', v: 'accent-soft', use: 'seçili satır' },
  { name: '--up', v: 'up', use: 'artış' },
  { name: '--down', v: 'down', use: 'azalış' },
  { name: '--warn', v: 'warn', use: 'uyarı' },
  { name: '--text', v: 'text', use: 'birincil metin' },
  { name: '--text-2', v: 'text-2', use: 'ikincil metin' },
  { name: '--text-3', v: 'text-3', use: 'ipucu, meta' },
  { name: '--stroke', v: 'stroke', use: '1px kenar' },
  { name: '--stroke-strong', v: 'stroke-strong', use: 'ayırıcı' },
];

function Palette() {
  return (
    <Section title="Renkler" note="Renk yalnız anlam taşır: vurgu etkileşim/seçili, yeşil/kırmızı artış/azalış, sarı uyarı.">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
        {SWATCHES.map((s) => (
          <div key={s.v} className="overflow-hidden rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--stroke)]">
            <div className="h-14 border-b border-stroke" style={{ background: `var(--${s.v})` }} />
            <div className="px-3 py-2">
              <p className="font-mono text-xs text-fg">{s.name}</p>
              <p className="text-xs text-fg-3">{s.use}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6 text-sm text-fg-2">
        <span>Köşe: kart 12 · kontrol 8 · küçük 6 · hap 999</span>
        <span>Boşluk: 4 · 8 · 12 · 16 · 24 · 32 · 48</span>
      </div>
    </Section>
  );
}

/* ───────────── Tipografi ───────────── */

const TYPE: ReadonlyArray<{ cls: string; px: number; w: number; name: string; sample: string }> = [
  { cls: 'text-4xl font-semibold tabular-nums font-display', px: 40, w: 600, name: 'Saat', sample: '09:41' },
  { cls: 'text-3xl font-semibold tabular-nums font-display', px: 28, w: 600, name: 'Büyük değer', sample: '41,52' },
  { cls: 'text-xl font-semibold font-display', px: 20, w: 600, name: 'Sayfa başlığı', sample: 'Günaydın, Alperen' },
  { cls: 'text-lg font-semibold font-display', px: 16, w: 600, name: 'Kart başlığı', sample: 'Piyasalar' },
  { cls: 'text-base', px: 14, w: 400, name: 'Gövde', sample: 'Merkez Bankası faiz kararını açıkladı; piyasalar sakin.' },
  { cls: 'text-sm', px: 13, w: 400, name: 'Yoğun liste', sample: 'Toplantı notları — Pazartesi planlama' },
  { cls: 'text-xs text-fg-3', px: 12, w: 400, name: 'Meta', sample: 'Anadolu Ajansı · 12 dk önce' },
];

function TypeScale() {
  return (
    <Section title="Tipografi" note="Segoe UI Variable. Ağırlık yalnız 400 ve 600; rakamlar tabular.">
      <Card>
        <CardBody className="flex flex-col divide-y divide-stroke !py-2">
          {TYPE.map((r) => (
            <div key={r.px} className="grid grid-cols-[150px_1fr] items-baseline gap-6 py-3">
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-fg-3">
                  {r.px}px · {r.w}
                </p>
              </div>
              <p className={cx('truncate', r.cls)}>{r.sample}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </Section>
  );
}

/* ───────────── Bileşenler ───────────── */

function Components() {
  const toast = useToast();
  const [seg, setSeg] = useState('day');
  const [tab, setTab] = useState('all');
  const [sel, setSel] = useState(1);
  const [on, setOn] = useState(true);
  const [dialog, setDialog] = useState(false);

  return (
    <Section title="Bileşenler" note="Her bileşen durumlarıyla: varsayılan, seçili/açık, devre dışı.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Düğmeler" />
          <CardBody className="flex flex-col gap-4">
            <div>
              <Label>32px</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary">Birincil</Button>
                <Button>İkincil</Button>
                <Button variant="ghost">Düz</Button>
                <Button variant="danger">Sil</Button>
                <Button variant="primary" icon={Plus}>
                  İkonlu
                </Button>
                <Button variant="primary" disabled>
                  Devre dışı
                </Button>
                <Button disabled>Devre dışı</Button>
              </div>
            </div>
            <div>
              <Label>Yoğun 28px</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary">
                  Birincil
                </Button>
                <Button size="sm">İkincil</Button>
                <Button size="sm" variant="ghost">
                  Düz
                </Button>
                <Button size="sm" variant="danger" icon={Trash2}>
                  Sil
                </Button>
              </div>
            </div>
            <div>
              <Label>Simge düğmeleri</Label>
              <div className="flex items-center gap-1">
                <IconButton icon={RefreshCw} label="Yenile" />
                <IconButton icon={Pin} label="Sabitle" active />
                <IconButton icon={Bell} label="Bildirimler" />
                <IconButton icon={Trash2} label="Sil" tone="danger" />
                <IconButton icon={Copy} label="Kopyala" disabled />
                <ToolbarSeparator />
                <IconButton icon={RefreshCw} label="Yenile (yoğun)" size="sm" />
                <IconButton icon={Pencil} label="Düzenle (yoğun)" size="sm" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Girdiler" />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad" hint="Panoda görünen ad">
                <TextInput placeholder="Örn. Günlük" />
              </Field>
              <Field label="Şehir" error="Şehir bulunamadı">
                <TextInput defaultValue="Ankarr" aria-invalid />
              </Field>
              <Field label="Birim">
                <Select defaultValue="c">
                  <option value="c">Celsius</option>
                  <option value="f">Fahrenheit</option>
                </Select>
              </Field>
              <Field label="Devre dışı">
                <TextInput disabled defaultValue="Salt okunur" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Segmented
                label="Aralık"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: 'day', label: 'Gün' },
                  { value: 'week', label: 'Hafta' },
                  { value: 'month', label: 'Ay' },
                ]}
              />
              <div className="flex items-center gap-3">
                <Toggle label="Açık" checked={on} onChange={setOn} />
                <Toggle label="Kapalı" checked={false} onChange={() => {}} />
                <Toggle label="Devre dışı" checked disabled onChange={() => {}} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Nötr</Badge>
              <Badge tone="accent">Vurgu</Badge>
              <Badge tone="up">+0,34%</Badge>
              <Badge tone="down">-1,12%</Badge>
              <Badge tone="warn">Uyarı</Badge>
              <Badge tone="demo">DEMO</Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Liste"
            subtitle="44px, yoğun 36px"
            actions={<IconButton icon={Plus} label="Ekle" size="sm" />}
          />
          <CardBody dense className="flex flex-col gap-3">
            <List>
              {['Haberler', 'Piyasalar', 'Notlar'].map((x, i) => (
                <ListItem
                  key={x}
                  icon={[Newspaper, TrendingUp, NotebookPen][i] as LucideIcon}
                  title={x}
                  subtitle={i === 0 ? '404 haber, 7 kategori' : undefined}
                  trailing={i === 1 ? <Badge tone="up">+0,3%</Badge> : undefined}
                  selected={sel === i}
                  onClick={() => setSel(i)}
                />
              ))}
            </List>
            <div className="h-px bg-stroke" />
            <List>
              <ListItem dense title="Yoğun satır" trailing="12" onClick={() => {}} />
              <ListItem dense title="Yoğun satır, seçili" trailing="8" selected onClick={() => {}} />
              <ListItem dense title="Yoğun satır" trailing="3" onClick={() => {}} />
            </List>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Boş durum" />
          <EmptyState
            icon={Inbox}
            title="Henüz not yok"
            description="İlk notunu oluştur; Ctrl+K ile her yerden hızlıca not alabilirsin."
            action={<Button variant="primary" icon={Plus}>Yeni not</Button>}
          />
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Araç çubuğu, sekmeler ve katmanlar" />
          <CardBody className="flex flex-col gap-5">
            <Tabs
              label="Kategori"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'Tümü', count: 128 },
                { value: 'eco', label: 'Ekonomi', count: 34 },
                { value: 'tech', label: 'Teknoloji', count: 21 },
                { value: 'sport', label: 'Spor', count: 40 },
              ]}
            />
            <Toolbar>
              <TextInput placeholder="Ara…" className="w-56" />
              <IconButton icon={Search} label="Ara" />
              <ToolbarSeparator />
              <Segmented
                label="Görünüm"
                value="list"
                onChange={() => {}}
                options={[
                  { value: 'list', label: 'Liste' },
                  { value: 'grid', label: 'Kart' },
                ]}
              />
              <span className="flex-1" />
              <Tooltip text="Yenile (F5)">
                <IconButton icon={RefreshCw} label="Yenile" />
              </Tooltip>
              <Menu
                align="end"
                trigger={<Button icon={ChevronDown}>Menü</Button>}
                items={[
                  { label: 'Yeniden adlandır', icon: Pencil, shortcut: 'F2', onSelect: () => toast.push('info', 'Yeniden adlandır') },
                  { label: 'Kopyala', icon: Copy, shortcut: 'Ctrl+C', onSelect: () => toast.push('success', 'Kopyalandı') },
                  { type: 'separator' },
                  { label: 'Sil', icon: Trash2, danger: true, onSelect: () => toast.push('error', 'Silinemedi') },
                ]}
              />
              <Button onClick={() => setDialog(true)}>Diyalog</Button>
              <Button onClick={() => toast.push('success', 'Kaydedildi')}>Bildirim</Button>
            </Toolbar>
          </CardBody>
        </Card>
      </div>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Notu sil"
        description="Bu işlem geri alınamaz. Not ve eklenen görevler kalıcı olarak silinir."
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Vazgeç</Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Sil
            </Button>
          </>
        }
      />
    </Section>
  );
}

/* ───────────── Örnek kompozisyonlar ───────────── */

function Frame({ title, height, children }: { title: string; height: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      <div
        style={{ height }}
        className="overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_var(--stroke-strong)]"
      >
        {children}
      </div>
    </div>
  );
}

function Compositions() {
  return (
    <Section title="Örnek ekranlar" note="Gerçek bileşenlerle kurulmuş üç kompozisyon; veriler örnektir.">
      <Frame title="Ana sayfa" height={680}>
        <HomeSample />
      </Frame>
      <Frame title="Haberler" height={640}>
        <NewsSample />
      </Frame>
      <Frame title="Kabuk: kenar çubuğu, üst çubuk, durum çubuğu" height={640}>
        <ShellSample />
      </Frame>
    </Section>
  );
}

function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-fg-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const MARKETS = [
  { sym: 'USD/TRY', name: 'ABD Doları', val: '41,5210', chg: 0.12, spark: [3, 4, 4, 5, 4, 6, 6, 7, 8] },
  { sym: 'EUR/TRY', name: 'Euro', val: '48,3470', chg: 0.31, spark: [5, 4, 5, 6, 6, 7, 6, 8, 9] },
  { sym: 'GBP/TRY', name: 'İngiliz Sterlini', val: '55,9120', chg: -0.18, spark: [8, 8, 7, 7, 6, 7, 5, 5, 4] },
  { sym: 'ALTIN', name: 'Gram altın', val: '5.482,60', chg: 0.74, spark: [2, 3, 3, 4, 5, 5, 7, 8, 9] },
  { sym: 'BIST 100', name: 'Borsa İstanbul', val: '10.874,2', chg: -0.56, spark: [9, 8, 8, 7, 8, 6, 5, 5, 4] },
] as const;

function Spark({ pts, up }: { pts: readonly number[]; up: boolean }) {
  const w = 56;
  const h = 20;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * w).toFixed(1)} ${(h - 2 - ((p - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Change({ v }: { v: number }) {
  const up = v >= 0;
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <span className={cx('inline-flex w-[72px] items-center justify-end gap-0.5 text-sm font-semibold tabular-nums', up ? 'text-up' : 'text-down')}>
      <Icon size={14} strokeWidth={2} />
      {Math.abs(v).toFixed(2).replace('.', ',')}%
    </span>
  );
}

const AGENDA = [
  { time: '10:00', title: 'Haftalık planlama', meta: 'Toplantı odası 2', now: false },
  { time: '12:30', title: 'Öğle yemeği, Elif ile', meta: 'Kadıköy', now: false },
  { time: '15:00', title: 'Tasarım incelemesi', meta: '45 dk', now: true },
  { time: '18:30', title: 'Spor salonu', meta: 'Rutin', now: false },
];

function HomeSample() {
  const now = useClock();
  const hh = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const ss = now.toLocaleTimeString('tr-TR', { second: '2-digit' });
  const date = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        <PageHeader title="Günaydın, Alperen" subtitle="Bugün 3 etkinliğin ve 2 açık görevin var.">
          <Toolbar>
            <Button icon={Plus}>Yeni not</Button>
            <Button variant="primary" icon={CalendarDays}>
              Etkinlik ekle
            </Button>
          </Toolbar>
        </PageHeader>
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-5">
            <CardBody className="flex h-full flex-col justify-between gap-6 !p-5">
              <p className="text-sm text-fg-2 first-letter:uppercase">{date}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tabular-nums leading-none tracking-tight">{hh}</span>
                <span className="font-display text-xl tabular-nums text-fg-3">{ss}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-fg-2">
                <Badge>İstanbul</Badge>
                <span>UTC+3</span>
              </div>
            </CardBody>
          </Card>
          <Card className="col-span-12 md:col-span-7">
            <CardHeader title="Hava durumu" subtitle="İstanbul" actions={<IconButton icon={RefreshCw} label="Yenile" size="sm" />} />
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <CloudSun size={40} strokeWidth={1.25} className="text-fg-2" />
                <div>
                  <p className="font-display text-3xl font-semibold tabular-nums leading-none">18°</p>
                  <p className="mt-1 text-sm text-fg-2">Parçalı bulutlu · Hissedilen 16°</p>
                </div>
                <div className="ml-auto text-right text-sm text-fg-2 tabular-nums">
                  <p>Yüksek 21°</p>
                  <p>Düşük 13°</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ['Öğle', '20°', Cloud],
                  ['Akşam', '17°', Cloud],
                  ['Yarın', '19°', CloudSun],
                  ['Cuma', '16°', Cloud],
                ].map(([l, v, I]) => {
                  const Icon = I as LucideIcon;
                  return (
                    <div key={l as string} className="flex flex-col items-center gap-1 rounded-lg bg-control py-2">
                      <span className="text-xs text-fg-3">{l as string}</span>
                      <Icon size={16} strokeWidth={1.75} className="text-fg-2" />
                      <span className="text-sm font-semibold tabular-nums">{v as string}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
          <Card className="col-span-12 md:col-span-7">
            <CardHeader title="Piyasalar" subtitle="Referans kurlar · TCMB" actions={<Badge>Referans</Badge>} />
            <CardBody dense>
              <List>
                {MARKETS.map((m) => (
                  <ListItem
                    key={m.sym}
                    title={m.sym}
                    subtitle={m.name}
                    trailing={
                      <span className="flex items-center gap-4">
                        <Spark pts={m.spark} up={m.chg >= 0} />
                        <span className="w-[84px] text-right text-base font-semibold tabular-nums text-fg">{m.val}</span>
                        <Change v={m.chg} />
                      </span>
                    }
                    onClick={() => {}}
                  />
                ))}
              </List>
            </CardBody>
          </Card>
          <Card className="col-span-12 md:col-span-5">
            <CardHeader title="Bugünün ajandası" actions={<Badge tone="accent">4</Badge>} />
            <CardBody dense>
              <List>
                {AGENDA.map((a) => (
                  <ListItem
                    key={a.time}
                    selected={a.now}
                    title={a.title}
                    subtitle={a.meta}
                    leading={<span className={cx('w-11 shrink-0 text-sm font-semibold tabular-nums', a.now ? 'text-accent' : 'text-fg-2')}>{a.time}</span>}
                  />
                ))}
              </List>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

const NEWS = [
  { src: 'Anadolu Ajansı', cat: 'Ekonomi', t: '12 dk', title: 'Merkez Bankası politika faizini sabit tuttu', sum: 'Kurul, enflasyondaki ana eğilimin gerilediğini belirterek sıkı para politikası duruşunun süreceğini bildirdi.' },
  { src: 'Webrazzi', cat: 'Teknoloji', t: '38 dk', title: 'Yerli yapay zekâ girişimi 20 milyon dolar yatırım aldı', sum: 'Tur, bölgesel risk sermayesi fonlarının öncülüğünde tamamlandı; fon ürün ekibini büyütmek için kullanılacak.' },
  { src: 'Habertürk', cat: 'Gündem', t: '1 sa', title: 'İstanbul için sağanak yağış uyarısı yapıldı', sum: 'Meteoroloji, akşam saatlerinden itibaren Marmara kıyılarında kuvvetli yağış beklendiğini duyurdu.' },
  { src: 'NTV Spor', cat: 'Spor', t: '2 sa', title: 'Milli takım hazırlık kampı için toplanıyor', sum: 'Teknik heyet, kamp kadrosunu açıkladı; iki yeni isim ilk kez çağrıldı.' },
  { src: 'Donanım Haber', cat: 'Teknoloji', t: '3 sa', title: 'Yeni nesil işlemci ailesinin ilk testleri yayımlandı', sum: 'Çok çekirdekli yüklerde belirgin bir artış, güç tüketiminde ise sınırlı bir düşüş görülüyor.' },
] as const;

function NewsSample() {
  const [cat, setCat] = useState('all');
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState('all');
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
      <PageHeader title="Haberler" subtitle="7 kaynak, son güncelleme 2 dk önce">
        <Toolbar>
          <TextInput placeholder="Haberlerde ara…" className="w-60" />
          <Segmented
            label="Filtre"
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'unread', label: 'Okunmamış' },
            ]}
          />
          <IconButton icon={RefreshCw} label="Yenile" />
        </Toolbar>
      </PageHeader>
      <Tabs
        label="Kategori"
        value={cat}
        onChange={setCat}
        options={[
          { value: 'all', label: 'Tümü', count: 128 },
          { value: 'eco', label: 'Ekonomi', count: 34 },
          { value: 'tech', label: 'Teknoloji', count: 21 },
          { value: 'gen', label: 'Gündem', count: 33 },
          { value: 'sport', label: 'Spor', count: 40 },
        ]}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col p-2">
          {NEWS.map((n, i) => (
            <button
              key={n.title}
              type="button"
              onClick={() => setSelected(i)}
              className={cx(
                'flex w-full flex-col gap-1 rounded-lg px-4 py-3 text-left transition-colors duration-150',
                selected === i ? 'bg-accent-soft' : 'hover:bg-card-hover',
              )}
            >
              <span className="flex items-center gap-2 text-xs text-fg-3">
                <span className="font-semibold text-fg-2">{n.src}</span>
                <span aria-hidden>·</span>
                <span>{n.t} önce</span>
                <Badge>{n.cat}</Badge>
              </span>
              <span className="text-base font-semibold text-fg">{n.title}</span>
              <span className="line-clamp-2 text-sm text-fg-2">{n.sum}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

const NAV: ReadonlyArray<{ group?: string; items: ReadonlyArray<{ id: string; label: string; icon: LucideIcon }> }> = [
  { items: [{ id: 'home', label: 'Ana sayfa', icon: LayoutDashboard }] },
  {
    group: 'Çalışma',
    items: [
      { id: 'notes', label: 'Notlar', icon: NotebookPen },
      { id: 'clip', label: 'Pano geçmişi', icon: ClipboardList },
      { id: 'launch', label: 'Başlatıcı', icon: AppWindow },
    ],
  },
  {
    group: 'Bilgi',
    items: [
      { id: 'news', label: 'Haberler', icon: Newspaper },
      { id: 'markets', label: 'Piyasalar', icon: TrendingUp },
      { id: 'weather', label: 'Hava durumu', icon: CloudSun },
    ],
  },
  {
    group: 'Medya',
    items: [
      { id: 'music', label: 'Müzik', icon: Music2 },
      { id: 'radio', label: 'Radyo', icon: Radio },
    ],
  },
];

function ShellSample() {
  const [active, setActive] = useState('notes');
  const [collapsed, setCollapsed] = useState(false);
  const now = useClock();
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const title = NAV.flatMap((g) => g.items).find((i) => i.id === active)?.label ?? 'Ayarlar';
  return (
    <div className="flex h-full">
      <aside
        style={{ width: collapsed ? 56 : 232 }}
        className="flex shrink-0 flex-col border-r border-stroke bg-layer transition-[width] duration-150 ease-[cubic-bezier(.2,0,0,1)]"
      >
        <div className={cx('flex h-12 items-center gap-2.5', collapsed ? 'justify-center' : 'px-4')}>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-display text-sm font-semibold text-on-accent">A</span>
          {!collapsed && <span className="font-display text-base font-semibold">Alpicim</span>}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
          {NAV.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {g.group && !collapsed && (
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-3">{g.group}</p>
              )}
              {g.group && collapsed && gi > 0 && <div className="mx-3 mb-1 h-px bg-stroke" />}
              {g.items.map((it) => (
                <NavItem key={it.id} icon={it.icon} label={it.label} active={active === it.id} collapsed={collapsed} onClick={() => setActive(it.id)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-stroke px-2 py-2">
          <NavItem icon={SettingsIcon} label="Ayarlar" active={active === 'settings'} collapsed={collapsed} onClick={() => setActive('settings')} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 px-6">
          <IconButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? 'Kenar çubuğunu aç' : 'Kenar çubuğunu daralt'}
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
          />
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <span className="flex-1" />
          {active === 'notes' && (
            <>
              <Button size="sm" icon={Plus}>
                Yeni
              </Button>
              <IconButton icon={Pin} label="Sabitle" size="sm" />
            </>
          )}
          <button
            type="button"
            className="flex h-8 w-56 items-center gap-2 rounded-lg bg-control px-2.5 text-sm text-fg-3 shadow-[inset_0_0_0_1px_var(--stroke)] transition-colors hover:bg-control-hover"
          >
            <Search size={14} strokeWidth={1.75} />
            <span className="flex-1 text-left">Ara veya komut yaz</span>
            <kbd className="rounded bg-control px-1.5 text-xs text-fg-2">Ctrl K</kbd>
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden px-6 pb-4">
          <div className="grid h-full grid-cols-[280px_1fr] gap-4">
            <Card className="flex min-h-0 flex-col">
              <div className="p-3 pb-1">
                <TextInput placeholder="Notlarda ara…" className="w-full" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <List>
                  {[
                    ['Haftalık planlama', 'Bugün · 3 görev'],
                    ['Kitap listesi', 'Dün'],
                    ['Alışveriş', '24 Ekim'],
                    ['Proje fikirleri', '21 Ekim'],
                    ['Toplantı notları', '18 Ekim'],
                  ].map(([a, b], i) => (
                    <ListItem key={a} title={a ?? ''} subtitle={b} selected={i === 0} onClick={() => {}} />
                  ))}
                </List>
              </div>
            </Card>
            <Card className="min-h-0 overflow-hidden">
              <CardHeader
                title="Haftalık planlama"
                subtitle="Düzenlendi: bugün 09:12"
                actions={
                  <>
                    <IconButton icon={Pencil} label="Düzenle" size="sm" />
                    <Menu
                      align="end"
                      trigger={<IconButton icon={ChevronDown} label="Diğer" size="sm" />}
                      items={[
                        { label: 'Kopyala', icon: Copy, onSelect: () => {} },
                        { type: 'separator' },
                        { label: 'Sil', icon: Trash2, danger: true, onSelect: () => {} },
                      ]}
                    />
                  </>
                }
              />
              <CardBody className="flex flex-col gap-3 text-base">
                <p className="text-fg-2">Bu haftanın öncelikleri ve açık işler.</p>
                <ul className="flex flex-col gap-2">
                  {[
                    ['Tasarım belirteçlerini onaya sun', true],
                    ['Modül mimarisini gözden geçir', false],
                    ['Kullanıcı belgelerini güncelle', false],
                  ].map(([x, done]) => (
                    <li key={x as string} className="flex items-center gap-2.5">
                      <span
                        className={cx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] shadow-[inset_0_0_0_1px_var(--text-3)]',
                          done && 'bg-accent shadow-none',
                        )}
                      >
                        {done && <span className="h-2 w-1 rotate-45 border-b-2 border-r-2 border-on-accent" />}
                      </span>
                      <span className={done ? 'text-fg-3 line-through' : 'text-fg'}>{x as string}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </main>
        <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-stroke bg-layer px-4 text-xs text-fg-2">
          <span className="tabular-nums">USD/TRY 41,52</span>
          <span className="tabular-nums">EUR/TRY 48,35</span>
          <span className="tabular-nums text-up">BIST +0,42%</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5 text-fg-2">
            <Music2 size={14} strokeWidth={1.75} />
            <span className="max-w-[220px] truncate">Boards of Canada · Roygbiv</span>
            <IconButton icon={SkipForward} label="Sonraki" size="sm" className="!h-6 !w-6" />
          </span>
          <span className="tabular-nums text-fg">{time}</span>
        </footer>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
        collapsed ? 'w-10 justify-center self-center' : 'w-full px-3',
        active ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-2 hover:bg-card-hover hover:text-fg',
      )}
    >
      {active && !collapsed && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon size={20} strokeWidth={1.75} className={active ? 'text-accent' : undefined} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
  return collapsed ? <Tooltip text={label} side="bottom">{btn}</Tooltip> : btn;
}
