import React from 'react';
import type { SvgProps } from 'react-native-svg';
import {
  Activity,
  Award,
  Bell,
  Bookmark,
  Calendar,
  CalendarPlus,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Crown,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Home,
  Info,
  Lock,
  LogOut,
  Mail,
  Medal,
  MessageCircle,
  Minus,
  Moon,
  MoreVertical,
  PartyPopper,
  Pause,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  Repeat,
  RotateCcw,
  Ruler,
  Scale,
  Search,
  Settings,
  Share2,
  SkipForward,
  Square,
  Star,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
  Weight,
  X,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

const ICONS = {
  activity: Activity,
  award: Award,
  bell: Bell,
  bookmark: Bookmark,
  calendar: Calendar,
  calendarPlus: CalendarPlus,
  camera: Camera,
  check: Check,
  checkSquare: CheckSquare,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  circleAlert: CircleAlert,
  circleCheck: CircleCheck,
  clock: Clock,
  copy: Copy,
  crown: Crown,
  dumbbell: Dumbbell,
  eye: Eye,
  eyeOff: EyeOff,
  flame: Flame,
  heart: Heart,
  home: Home,
  info: Info,
  lock: Lock,
  logOut: LogOut,
  mail: Mail,
  medal: Medal,
  messageCircle: MessageCircle,
  minus: Minus,
  moon: Moon,
  moreVertical: MoreVertical,
  partyPopper: PartyPopper,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  plusCircle: PlusCircle,
  repeat: Repeat,
  rotateCcw: RotateCcw,
  ruler: Ruler,
  scale: Scale,
  search: Search,
  settings: Settings,
  share: Share2,
  skipForward: SkipForward,
  square: Square,
  star: Star,
  target: Target,
  timer: Timer,
  trash: Trash2,
  trendingDown: TrendingDown,
  trendingUp: TrendingUp,
  trophy: Trophy,
  user: User,
  users: Users,
  weight: Weight,
  x: X,
  zap: Zap,
} as const;

export type IconName = keyof typeof ICONS;

type IconSize = 'sm' | 'md' | 'lg' | number;

type IconProps = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  name: IconName;
  size?: IconSize;
  color?: string;
  strokeWidth?: number;
};

/**
 * Single entry point for every icon in the app — all icons come from Lucide's
 * outline set with a shared default stroke width, so nothing drifts to a
 * different icon family or weight.
 */
export function Icon({ name, size = 'md', color, strokeWidth = 2, ...rest }: IconProps) {
  const theme = useTheme();
  const Glyph = ICONS[name];
  const resolvedSize = typeof size === 'number' ? size : theme.sizes.icon[size];
  return (
    <Glyph
      size={resolvedSize}
      color={color ?? theme.colors.text.primary}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
}
