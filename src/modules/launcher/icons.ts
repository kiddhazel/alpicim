import {
  AppWindow,
  BookOpen,
  Briefcase,
  Calculator,
  Code2,
  ExternalLink,
  File,
  Film,
  Folder,
  Gamepad2,
  Globe,
  Image,
  Mail,
  MessageCircle,
  Music,
  PenTool,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

/** Kartlarda seçilebilen simgeler (Rust tarafında ad olarak saklanır). */
export const LAUNCHER_ICONS: Record<string, LucideIcon> = {
  'app-window': AppWindow,
  'external-link': ExternalLink,
  folder: Folder,
  file: File,
  'gamepad-2': Gamepad2,
  'code-2': Code2,
  globe: Globe,
  music: Music,
  image: Image,
  terminal: Terminal,
  briefcase: Briefcase,
  'message-circle': MessageCircle,
  mail: Mail,
  calculator: Calculator,
  film: Film,
  'book-open': BookOpen,
  'pen-tool': PenTool,
};

export function launcherIcon(name: string): LucideIcon {
  return LAUNCHER_ICONS[name] ?? AppWindow;
}

/** Bu değerlerden biri seçiliyse kartta uygulamanın kendi Windows simgesi gösterilir. */
const SYSTEM_ICON_VALUES = new Set(['system', 'app-window', 'external-link', 'folder', 'file']);

export function usesSystemIcon(icon: string): boolean {
  return SYSTEM_ICON_VALUES.has(icon);
}
