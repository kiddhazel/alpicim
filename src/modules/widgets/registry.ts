import {
  AppWindow,
  CalendarDays,
  CheckSquare,
  Clock3,
  CloudSun,
  Coins,
  Cookie,
  Smile,
  Cpu,
  Hourglass,
  Link2,
  ListChecks,
  NotebookPen,
  SlidersHorizontal,
  Music2,
  Image as ImageIcon,
  ScrollText,
  Newspaper,
  StickyNote,
  Star,
  Timer,
  TrendingUp,
  Clapperboard,
  MonitorCog,
} from 'lucide-react';
import { CalendarWidget, calendarDefaults, sanitizeCalendar } from './basic/CalendarWidget';
import { LinksSettings, LinksWidget, linksDefaults, sanitizeLinks } from './basic/LinksWidget';
import { ClockSettings, ClockWidget, clockDefaults, sanitizeClock } from './basic/ClockWidget';
import { NotesWidget, notesDefaults, sanitizeNotes } from './basic/NotesWidget';
import { PomodoroSettings, PomodoroWidget, pomodoroDefaults, sanitizePomodoro } from './basic/PomodoroWidget';
import { TodoWidget, sanitizeTodo, todoDefaults } from './basic/TodoWidget';
import { FavoritesSettings, FavoritesWidget, favoritesDefaults, sanitizeFavorites } from './data/FavoritesWidget';
import { MarketsWidget } from './data/MarketsWidget';
import { MusicWidget } from './data/MusicWidget';
import { NewsSettings, NewsWidget, newsDefaults, sanitizeNewsWidget } from './data/NewsWidget';
import { GpuWidget, gpuDefaults, sanitizeGpu } from './data/GpuWidget';
import { SystemSettings, SystemWidget, sanitizeSystem, systemDefaults } from './data/SystemWidget';
import { MixerWidget } from './data/MixerWidget';
import { WindowsWidget } from './data/WindowsWidget';
import { ConverterWidget, converterDefaults, sanitizeConverter } from './daily/ConverterWidget';
import { CountdownSettings, CountdownWidget, countdownDefaults, sanitizeCountdown } from './daily/CountdownWidget';
import { HabitsSettings, HabitsWidget, habitsDefaults, sanitizeHabits } from './daily/HabitsWidget';
import { QuickNoteWidget } from './daily/QuickNoteWidget';
import { FortuneWidget } from './fun/FortuneWidget';
import { MoodWidget } from './fun/MoodWidget';
import { WatchlistWidget } from './fun/WatchlistWidget';
import { PhotoWidget, photoDefaults, sanitizePhoto } from './photo/PhotoWidget';
import { ProverbWidget } from './proverbs/ProverbWidget';
import type { WidgetDefinition, WidgetType } from './types';
import { WeatherSettings, WeatherWidget, sanitizeWeather, weatherDefaults } from './weather/WeatherWidget';

const empty = () => ({}) as Record<string, never>;

/**
 * Widget kaydı. Yeni widget: ayrı bir bileşen + varsayılan/doğrulama + buraya bir kayıt + tr.ts metinleri.
 * Tanımlar farklı ayar türleri taşıdığı için kayıt düzeyinde `unknown` ayarla tutulur; her widget
 * kendi `sanitize` fonksiyonuyla ayarını doğrular.
 */
function def<C>(d: WidgetDefinition<C>): WidgetDefinition<Record<string, unknown>> {
  return d as unknown as WidgetDefinition<Record<string, unknown>>;
}

export const WIDGETS: readonly WidgetDefinition<Record<string, unknown>>[] = [
  def({
    type: 'clock',
    titleKey: 'widgets.clock.title',
    descriptionKey: 'widgets.clock.description',
    icon: Clock3,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 2, minH: 2, maxW: 12, maxH: 4 },
    defaults: clockDefaults,
    sanitize: sanitizeClock,
    Component: ClockWidget,
    Settings: ClockSettings,
  }),
  def({
    type: 'weather',
    titleKey: 'widgets.weather.title',
    descriptionKey: 'widgets.weather.description',
    icon: CloudSun,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 5 },
    defaults: weatherDefaults,
    sanitize: sanitizeWeather,
    Component: WeatherWidget,
    Settings: WeatherSettings,
  }),
  def({
    type: 'notes',
    titleKey: 'widgets.notes.title',
    descriptionKey: 'widgets.notes.description',
    icon: StickyNote,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 2, minH: 2, maxW: 12, maxH: 10 },
    defaults: notesDefaults,
    sanitize: sanitizeNotes,
    Component: NotesWidget,
  }),
  def({
    type: 'todo',
    titleKey: 'widgets.todo.title',
    descriptionKey: 'widgets.todo.description',
    icon: CheckSquare,
    defaultSize: { w: 4, h: 4 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 10 },
    defaults: todoDefaults,
    sanitize: sanitizeTodo,
    Component: TodoWidget,
  }),
  def({
    type: 'pomodoro',
    titleKey: 'widgets.pomodoro.title',
    descriptionKey: 'widgets.pomodoro.description',
    icon: Timer,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 4 },
    defaults: pomodoroDefaults,
    sanitize: sanitizePomodoro,
    Component: PomodoroWidget,
    Settings: PomodoroSettings,
  }),
  def({
    type: 'system',
    titleKey: 'widgets.system.title',
    descriptionKey: 'widgets.system.description',
    icon: Cpu,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 4 },
    defaults: systemDefaults,
    sanitize: sanitizeSystem,
    Component: SystemWidget,
    Settings: SystemSettings,
  }),
  def({
    type: 'favorites',
    titleKey: 'widgets.favorites.title',
    descriptionKey: 'widgets.favorites.description',
    icon: Star,
    defaultSize: { w: 6, h: 2 },
    limits: { minW: 2, minH: 2, maxW: 12, maxH: 8 },
    defaults: favoritesDefaults,
    sanitize: sanitizeFavorites,
    Component: FavoritesWidget,
    Settings: FavoritesSettings,
  }),
  def({
    type: 'news',
    titleKey: 'widgets.news.title',
    descriptionKey: 'widgets.news.description',
    icon: Newspaper,
    defaultSize: { w: 6, h: 4 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 10 },
    defaults: newsDefaults,
    sanitize: sanitizeNewsWidget,
    Component: NewsWidget,
    Settings: NewsSettings,
  }),
  def({
    type: 'markets',
    titleKey: 'widgets.markets.title',
    descriptionKey: 'widgets.markets.description',
    icon: TrendingUp,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 10 },
    defaults: {},
    sanitize: empty,
    Component: MarketsWidget,
  }),
  def({
    type: 'music',
    titleKey: 'widgets.music.title',
    descriptionKey: 'widgets.music.description',
    icon: Music2,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 3 },
    defaults: {},
    sanitize: empty,
    Component: MusicWidget,
  }),
  def({
    type: 'windows',
    titleKey: 'widgets.windows.title',
    descriptionKey: 'widgets.windows.description',
    icon: AppWindow,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 8 },
    defaults: {},
    sanitize: empty,
    Component: WindowsWidget,
  }),
  def({
    type: 'calendar',
    titleKey: 'widgets.calendar.title',
    descriptionKey: 'widgets.calendar.description',
    icon: CalendarDays,
    defaultSize: { w: 4, h: 4 },
    limits: { minW: 3, minH: 3, maxW: 12, maxH: 10 },
    defaults: calendarDefaults,
    sanitize: sanitizeCalendar,
    Component: CalendarWidget,
  }),
  def({
    type: 'links',
    titleKey: 'widgets.links.title',
    descriptionKey: 'widgets.links.description',
    icon: Link2,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 2, minH: 2, maxW: 12, maxH: 8 },
    defaults: linksDefaults,
    sanitize: sanitizeLinks,
    Component: LinksWidget,
    Settings: LinksSettings,
  }),
  def({
    type: 'habits',
    titleKey: 'widgets.habits.title',
    descriptionKey: 'widgets.habits.description',
    icon: ListChecks,
    defaultSize: { w: 6, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 8 },
    defaults: habitsDefaults,
    sanitize: sanitizeHabits,
    Component: HabitsWidget,
    Settings: HabitsSettings,
  }),
  def({
    type: 'countdown',
    titleKey: 'widgets.countdown.title',
    descriptionKey: 'widgets.countdown.description',
    icon: Hourglass,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 8 },
    defaults: countdownDefaults,
    sanitize: sanitizeCountdown,
    Component: CountdownWidget,
    Settings: CountdownSettings,
  }),
  def({
    type: 'converter',
    titleKey: 'widgets.converter.title',
    descriptionKey: 'widgets.converter.description',
    icon: Coins,
    defaultSize: { w: 4, h: 2 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 4 },
    defaults: converterDefaults,
    sanitize: sanitizeConverter,
    Component: ConverterWidget,
  }),
  def({
    type: 'mixer',
    titleKey: 'widgets.mixer.title',
    descriptionKey: 'widgets.mixer.description',
    icon: SlidersHorizontal,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 8 },
    defaults: {},
    sanitize: empty,
    Component: MixerWidget,
  }),
  def({
    type: 'quicknote',
    titleKey: 'widgets.quicknote.title',
    descriptionKey: 'widgets.quicknote.description',
    icon: NotebookPen,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 8 },
    defaults: {},
    sanitize: empty,
    Component: QuickNoteWidget,
  }),
  def({
    type: 'fortune',
    titleKey: 'widgets.fortune.title',
    descriptionKey: 'widgets.fortune.description',
    icon: Cookie,
    defaultSize: { w: 3, h: 3 },
    limits: { minW: 2, minH: 2, maxW: 6, maxH: 6 },
    defaults: {},
    sanitize: empty,
    Component: FortuneWidget,
  }),
  def({
    type: 'mood',
    titleKey: 'widgets.mood.title',
    descriptionKey: 'widgets.mood.description',
    icon: Smile,
    defaultSize: { w: 4, h: 4 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 8 },
    defaults: {},
    sanitize: empty,
    Component: MoodWidget,
  }),
  def({
    type: 'photo',
    titleKey: 'widgets.photo.title',
    descriptionKey: 'widgets.photo.description',
    icon: ImageIcon,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 12, maxH: 8 },
    defaults: photoDefaults,
    sanitize: sanitizePhoto,
    Component: PhotoWidget,
  }),
  def({
    type: 'proverb',
    titleKey: 'widgets.proverb.title',
    descriptionKey: 'widgets.proverb.description',
    icon: ScrollText,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 6 },
    defaults: {},
    sanitize: empty,
    Component: ProverbWidget,
  }),
  def({
    type: 'watchlist',
    titleKey: 'widgets.watchlist.title',
    descriptionKey: 'widgets.watchlist.description',
    icon: Clapperboard,
    defaultSize: { w: 5, h: 5 },
    limits: { minW: 4, minH: 3, maxW: 10, maxH: 10 },
    defaults: {},
    sanitize: empty,
    Component: WatchlistWidget,
  }),
  def({
    type: 'gpu',
    titleKey: 'widgets.gpu.title',
    descriptionKey: 'widgets.gpu.description',
    icon: MonitorCog,
    defaultSize: { w: 4, h: 3 },
    limits: { minW: 3, minH: 2, maxW: 8, maxH: 5 },
    defaults: gpuDefaults,
    sanitize: sanitizeGpu,
    Component: GpuWidget,
  }),
];

export function widgetDef(type: WidgetType): WidgetDefinition<Record<string, unknown>> {
  return WIDGETS.find((w) => w.type === type) ?? (WIDGETS[0] as WidgetDefinition<Record<string, unknown>>);
}
