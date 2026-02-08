# Input

Text input with validation styles, size, icons, and helper text.

## Props

- **variant**: 'default' | 'error' | 'success' | 'warning' (default 'default')
- **size**: 'sm' | 'md' | 'lg' (default 'md')
- **label**: string
- **helperText** | **errorText** | **successText** | **warningText**: string
- **leftIcon** | **rightIcon**: ReactNode
- **showPasswordToggle**: boolean
- **containerClassName** | **labelClassName** | **inputClassName**
- All standard `<input>` props (excluding native 'size')

## Usage

```tsx
import { Input, PasswordInput } from '@/components/ui/Input';

export function Example() {
  return (
    <div className="space-y-4">
      <Input label="Email" type="email" placeholder="you@example.com" />
      <PasswordInput label="Password" errorText="At least 8 characters" />
    </div>
  );
}
```
