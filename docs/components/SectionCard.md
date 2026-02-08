# SectionCard

Framed content section with header and optional actions.

## Props

- **title**: string
- **subtitle**: string
- **actions**: ReactNode
- **className**: string
- children

## Usage

```tsx
import { SectionCard } from '@/components/ui/SectionCard';

export function Example() {
  return (
    <SectionCard title="Overview" subtitle="Today">
      <p>Content</p>
    </SectionCard>
  );
}
```
