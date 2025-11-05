## Components Reference

Public components are exported from `@/components` and sub-indexes. Below are stable, reusable UI and feature components with their props and examples.

### UI Components

#### Button
- Import: `import { Button, PrimaryButton, SecondaryButton, SuccessButton, WarningButton, DangerButton, GhostButton, OutlineButton } from '@/components/ui';`
- Props: `ButtonProps`
  - `variant`: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline' (default: 'primary')
  - `size`: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
  - `disabled`, `loading`, `type`, `onClick`, `title`, `aria-label`, `data-testid`

Example:
```tsx
<Button variant="success" size="lg" onClick={() => alert('Saved!')}>
  Save Changes
</Button>
```

#### Modal
- Import: `import { Modal, SmallModal, MediumModal, LargeModal, ExtraLargeModal, FullModal } from '@/components/ui';`
- Props: `ModalProps`
  - `isOpen` (required), `onClose` (required), `title`, `size`, `closeOnOverlayClick`, `closeOnEscape`, `showCloseButton`

Example:
```tsx
const [open, setOpen] = useState(false);
<>
  <Button onClick={() => setOpen(true)}>Open</Button>
  <Modal isOpen={open} onClose={() => setOpen(false)} title="Invite Member">
    <InviteForm />
  </Modal>
</>
```

#### Input
- Import: `import { Input, TextInput, EmailInput, PasswordInput, NumberInput, SearchInput, SmallInput, LargeInput } from '@/components/ui';`
- Props: `InputProps`
  - `variant`: 'default' | 'error' | 'success' | 'warning'
  - `size`: 'sm' | 'md' | 'lg'
  - `label`, `helperText`, `errorText`, `successText`, `warningText`, `leftIcon`, `rightIcon`, `showPasswordToggle`, `...inputProps`

Example:
```tsx
<TextInput label="Player Tag" placeholder="#ABC123" />
```

#### Other UI
- `GlassCard`, `TownHallBadge`, `LeagueBadge`, `ResourceDisplay`, `HeroLevel`, `ThemeToggle`

### Layout Components
- `DashboardLayout`, `TabNavigation`, `QuickActions`, `QuickActionsMenu`, `ModalsContainer`, `PlayerProfileModal`, `QuickDepartureModal`, `SettingsModal`

### Roster Components
- `RosterTable`, `TableHeader`, `TableRow`, `MobileCard`, `TableFilters`, `Pagination`, `RosterSummary`

### Insights
- `InsightsDashboard`

### Feature Components (selected)
- `ChangeDashboard`, `DepartureManager`, `PlayerDatabase`, `CoachingInsights`, `PlayerDNADashboard`, `DiscordPublisher`, `UserRoleSelector`, `LeadershipGuard`, `AccessManager`, `AccessSetup`, `AccessLogin`, `ApplicantsPanel`

Refer to `@/components/index.ts` and sub-indexes for the full export surface.
