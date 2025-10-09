# Button

A standardized button with variants and sizes.

## Props

- **variant**: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline' (default 'primary')
- **size**: 'sm' | 'md' | 'lg' | 'xl' (default 'md')
- **disabled**: boolean
- **loading**: boolean
- **type**: 'button' | 'submit' | 'reset'
- **onClick**: (event) => void
- Other: `title`, `aria-label`, `data-testid`, `className`, and children

## Usage

```tsx
import { Button, PrimaryButton } from '@/components/ui/Button';

export function Example() {
  return (
    <div className="space-x-2">
      <Button onClick={() => alert('clicked')}>Click me</Button>
      <PrimaryButton loading>Saving…</PrimaryButton>
    </div>
  );
}
```
