/**
 * UI Components Index
 * 
 * Centralized exports for all reusable UI components.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

// Button components
export {
  Button,
  PrimaryButton,
  SecondaryButton,
  SuccessButton,
  WarningButton,
  DangerButton,
  GhostButton,
  OutlineButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';

export { GlassCard } from './GlassCard';

// Clash of Clans themed components
export { TownHallBadge } from './TownHallBadge';
export { LeagueBadge } from './LeagueBadge';
export { ResourceDisplay } from './ResourceDisplay';
export { HeroLevel } from './HeroLevel';

// Theme components
export { ThemeToggle } from './ThemeToggle';

// Modal components
export {
  Modal,
  SmallModal,
  MediumModal,
  LargeModal,
  ExtraLargeModal,
  FullModal,
  type ModalProps,
  type ModalSize,
} from './Modal';

// Input components
export {
  Input,
  TextInput,
  EmailInput,
  PasswordInput,
  NumberInput,
  SearchInput,
  SmallInput,
  LargeInput,
  type InputProps,
  type InputVariant,
  type InputSize,
} from './Input';

// Skeleton components
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
} from './Skeleton';

export { RosterSkeleton } from './RosterSkeleton';
export { PlayerProfileSkeleton } from './PlayerProfileSkeleton';

// Error components
export {
  ErrorDisplay,
  categorizeError,
  type ErrorType,
} from './ErrorDisplay';

export { ErrorBoundary } from './ErrorBoundary';

// UI/UX Foundation Components
export {
  Tooltip,
  type TooltipTheme,
} from './Tooltip';

export {
  Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
} from './Breadcrumbs';

export {
  Tabs,
  type Tab,
  type TabsProps,
} from './Tabs';

export {
  MetricCard,
  type MetricCardProps,
} from './MetricCard';

export {
  InfoCard,
  type InfoCardProps,
  type InfoCardBadge,
  type InfoCardStat,
  type InfoCardBadgeTone,
} from './InfoCard';

export {
  MetricBar,
  type MetricBarProps,
  type MetricBarTone,
} from './MetricBar';

export {
  Badge,
  type BadgeProps,
  type BadgeTier,
} from './Badge';

export {
  BadgeToken,
  type BadgeTokenProps,
  type BadgeTokenTier,
} from './BadgeToken';

export {
  EmptyState,
  type EmptyStateProps,
} from './EmptyState';

export { SectionCard } from './SectionCard';

export {
  SectionHeader,
  type SectionHeaderProps,
} from './SectionHeader';

export {
  CollapsibleSection,
  type CollapsibleSectionProps,
} from './CollapsibleSection';

export {
  BackToTop,
  type BackToTopProps,
} from './BackToTop';
