import {
  Bot,
  Clapperboard,
  Glasses,
  Hand,
  House,
  NotebookPen,
  PanelsTopLeft,
  MonitorCog,
  Music2,
  MessageCircle,
  Gamepad2,
  Settings,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { HubSection } from './types';

export interface NavigationItem {
  id: HubSection;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const NAVIGATION: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    shortLabel: 'Home',
    description: 'Status, focus, and quick actions',
    icon: House,
  },
  {
    id: 'device',
    label: 'XREAL device',
    shortLabel: 'Device',
    description: 'Display connection and capabilities',
    icon: Glasses,
  },
  {
    id: 'display-studio',
    label: 'Display Layout Studio',
    shortLabel: 'Displays',
    description: 'Arrange physical and XREAL screens',
    icon: MonitorCog,
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    shortLabel: 'Media',
    description: 'Theatre mode and streaming launchers',
    icon: Clapperboard,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    description: 'Secure linked-device workspace',
    icon: MessageCircle,
  },
  {
    id: 'discord',
    label: 'Discord',
    shortLabel: 'Discord',
    description: 'Communities, chat, and voice',
    icon: Gamepad2,
  },
  {
    id: 'notes',
    label: 'Notes & study',
    shortLabel: 'Notes',
    description: 'Local notes and study capture',
    icon: NotebookPen,
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    shortLabel: 'Spaces',
    description: 'Launch grouped apps and layouts',
    icon: PanelsTopLeft,
  },
  {
    id: 'gestures',
    label: 'Gestures',
    shortLabel: 'Gestures',
    description: 'Map and safely simulate inputs',
    icon: Hand,
  },
  {
    id: 'agents',
    label: 'Agent desk',
    shortLabel: 'Agents',
    description: 'AI launchpad and workflows',
    icon: Bot,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Appearance, startup, and privacy',
    icon: Settings,
  },
];

export const MEDIA_NAVIGATION: Record<'spotify' | 'youtube', NavigationItem> = {
  spotify: {
    id: 'spotify',
    label: 'Spotify',
    shortLabel: 'Spotify',
    description: 'Premium music player',
    icon: Music2,
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    shortLabel: 'YouTube',
    description: 'Video and playlist player',
    icon: Video,
  },
};

export function getNavigationItem(section: HubSection) {
  return NAVIGATION.find((item) => item.id === section)
    ?? (section === 'spotify' || section === 'youtube' ? MEDIA_NAVIGATION[section] : NAVIGATION[0]);
}
