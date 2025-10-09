# Modal

Accessible modal with sizes and focus/scroll management.

## Props

- **isOpen**: boolean
- **onClose**: () => void
- **title**: string
- **size**: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default 'md')
- **closeOnOverlayClick**: boolean (default true)
- **closeOnEscape**: boolean (default true)
- **showCloseButton**: boolean (default true)
- **className**, `aria-label`, `data-testid`, children

## Usage

```tsx
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="My Modal">
        Content goes here
      </Modal>
    </>
  );
}
```
