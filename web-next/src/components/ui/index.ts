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
