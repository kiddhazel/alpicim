/**
 * Taranan uygulamaları ad, hedef yol ve Başlat menüsü klasörüne göre kategorilere ayırır.
 * Kurallar sırayla denenir; ilk eşleşen kazanır. Kullanıcı sonradan kategoriyi değiştirebilir.
 */

export const APP_CATEGORIES = [
  'Oyun',
  'İletişim',
  'İnternet',
  'Üretkenlik',
  'Geliştirme',
  'Medya ve Tasarım',
  'Sistem ve Araçlar',
  'Diğer',
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export interface CategorizeInput {
  name: string;
  /** .exe yolu veya steam:// gibi adres */
  target: string;
  /** Başlat menüsü klasörü */
  folder?: string;
}

export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GAME_PROTOCOLS = ['steam://', 'com.epicgames.launcher://', 'uplay://', 'battlenet://', 'origin://', 'origin2://', 'eadm://', 'goggalaxy://', 'riotclient://'];

/** Hedef yolda geçerse oyun sayılan klasörler. */
const GAME_PATHS = [
  '\\steamapps\\',
  '\\steam\\',
  '\\epic games\\',
  '\\riot games\\',
  '\\battle.net\\',
  '\\blizzard',
  '\\ubisoft',
  '\\ea games\\',
  '\\electronic arts\\',
  '\\gog galaxy\\',
  '\\rockstar games\\',
  '\\xboxgames\\',
  '\\battlestate games\\',
  '\\wargaming',
  '\\games\\',
];

type Rule = { category: AppCategory; words: string[] };

/** Ad/klasör içinde (kelime sınırına göre) aranan ifadeler. */
const RULES: Rule[] = [
  {
    category: 'Oyun',
    words: [
      'steam', 'epic games', 'battle net', 'riot client', 'valorant', 'league of legends', 'minecraft', 'roblox',
      'counter strike', 'dota', 'deadlock', 'escape from tarkov', 'tarkov', 'arena breakout', 'aion', 'gta',
      'grand theft auto', 'fortnite', 'ubisoft connect', 'ea app', 'ea', 'origin', 'gog galaxy', 'playnite',
      'overwolf', 'xbox', 'apex legends', 'rocket league', 'pubg', 'world of warcraft', 'warframe', 'genshin',
      'hoyoplay', 'battlestate games', 'game', 'games', 'oyun', 'launcher',
    ],
  },
  {
    category: 'İletişim',
    words: [
      'discord', 'whatsapp', 'telegram', 'slack', 'teams', 'microsoft teams', 'zoom', 'skype', 'signal', 'outlook',
      'thunderbird', 'mail', 'posta', 'messenger', 'viber', 'element', 'teamspeak', 'mumble', 'guilded',
    ],
  },
  {
    category: 'İnternet',
    words: [
      'chrome', 'google chrome', 'firefox', 'edge', 'microsoft edge', 'opera', 'opera gx', 'brave', 'vivaldi',
      'tor browser', 'qbittorrent', 'utorrent', 'bittorrent', 'filezilla', 'internet download manager', 'idm',
      'proton vpn', 'nordvpn', 'cloudflare warp',
    ],
  },
  {
    category: 'Üretkenlik',
    words: [
      'word', 'excel', 'powerpoint', 'onenote', 'access', 'publisher', 'office', 'microsoft 365', 'notion',
      'obsidian', 'evernote', 'libreoffice', 'acrobat', 'adobe acrobat', 'reader', 'foxit', 'notepad', 'not defteri',
      'todoist', 'trello', 'onedrive', 'dropbox', 'google drive', 'hesap makinesi', 'calculator', 'calc', 'takvim',
      'calendar', 'wps', 'sumatrapdf', 'pdf',
    ],
  },
  {
    category: 'Geliştirme',
    words: [
      'visual studio', 'visual studio code', 'vs code', 'jetbrains', 'intellij', 'pycharm', 'webstorm', 'rider',
      'clion', 'goland', 'android studio', 'git', 'git bash', 'github desktop', 'python', 'node js', 'docker',
      'postman', 'insomnia', 'terminal', 'windows terminal', 'powershell', 'wsl', 'ubuntu', 'cursor', 'sublime text',
      'unity', 'unity hub', 'unreal', 'epic games launcher dev', 'godot', 'dbeaver', 'heidisql', 'putty', 'winscp',
    ],
  },
  {
    category: 'Medya ve Tasarım',
    words: [
      'spotify', 'vlc', 'obs', 'obs studio', 'audacity', 'photoshop', 'illustrator', 'premiere', 'after effects',
      'lightroom', 'gimp', 'blender', 'krita', 'davinci resolve', 'handbrake', 'itunes', 'foobar2000', 'potplayer',
      'mpc', 'paint', 'paint net', 'figma', 'capcut', 'streamlabs', 'medal', 'shotcut', 'kdenlive', 'inkscape',
      'canva', 'clipchamp', 'fotograflar', 'photos', 'media player', 'medya oynatici',
    ],
  },
  {
    category: 'Sistem ve Araçlar',
    words: [
      'nvidia', 'geforce', 'nvidia app', 'amd', 'radeon', 'razer', 'razer synapse', 'logitech', 'g hub',
      'corsair', 'icue', 'steelseries', 'msi', 'asus', 'armoury crate', '7 zip', 'winrar', 'ccleaner', 'revo',
      'everything', 'powertoys', 'cpu z', 'gpu z', 'hwinfo', 'afterburner', 'rivatuner', 'crystaldiskinfo',
      'crystaldiskmark', 'remote desktop', 'uzak masaustu', 'mstsc', 'anydesk', 'teamviewer', 'parsec', 'virtualbox', 'vmware', 'malwarebytes', 'defender',
      'ayarlar', 'settings', 'denetim masasi', 'control panel', 'gorev yoneticisi', 'task manager',
      'microsoft store', 'driver', 'bios', 'realtek', 'intel', 'wallpaper engine', 'rainmeter', 'claude',
    ],
  },
];

function hasPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

export function categorize(app: CategorizeInput): AppCategory {
  const target = app.target.toLowerCase();
  if (GAME_PROTOCOLS.some((p) => target.startsWith(p))) return 'Oyun';
  if (GAME_PATHS.some((p) => target.includes(p))) return 'Oyun';

  const name = normalize(app.name);
  const folder = normalize(app.folder ?? '');
  const file = normalize(target.split(/[\\/]/).pop()?.replace(/\.exe$/, '') ?? '');

  // Önce ad, sonra exe adı, en son Başlat menüsü klasörü: ad en güvenilir sinyaldir.
  for (const hay of [name, file, folder]) {
    if (!hay) continue;
    for (const rule of RULES) {
      if (rule.words.some((w) => hasPhrase(hay, normalize(w)))) return rule.category;
    }
  }
  return 'Diğer';
}

/** Kategori sırası: sabit liste, ardından kullanıcının kendi kategorileri (alfabetik), en sonda kategorisiz. */
export function sortCategories(categories: Iterable<string>): string[] {
  const all = [...new Set(categories)];
  const known = APP_CATEGORIES.filter((c) => all.includes(c));
  const custom = all
    .filter((c) => c && !(APP_CATEGORIES as readonly string[]).includes(c))
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const diger = known.filter((c) => c === 'Diğer');
  const rest = known.filter((c) => c !== 'Diğer');
  return [...rest, ...custom, ...diger, ...(all.includes('') ? [''] : [])];
}
