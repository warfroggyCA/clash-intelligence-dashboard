# Vercel Build Errors Summary - Lessons Learned

This document summarizes the TypeScript/build errors encountered during Vercel deployment and the fixes applied. **Share this with developers to prevent these common mistakes.**

## Critical Errors Fixed

### 1. **Exporting Non-Existent Components**
**Error**: `Type error: Cannot find module './PagePlaceholder' or its corresponding type declarations.`

**Location**: `web-next/src/components/layout/index.ts`

**Problem**: 
- Exporting a component that doesn't exist
- No actual usage of the component anywhere in codebase
- Dead export left in index file

**Fix**: Removed the export statement for `PagePlaceholder`

**Lesson**: 
- ✅ **Always verify exports match actual files**
- ✅ **Remove unused exports during cleanup**
- ✅ **Use grep/search before adding exports**: `grep -r "PagePlaceholder" web-next/src`

---

### 2. **Incorrect Property Access on Nested Objects**
**Error**: `Type error: Property 'asOf' does not exist on type '{ snapshotDate: string; ... }'.`

**Location**: `web-next/src/lib/stores/dashboard-store.ts`

**Problem**:
- Accessing `roster?.snapshotMetadata?.asOf` when the actual property is `snapshotDate`
- Not reading the actual type definition before accessing properties

**Fix**: Changed to `roster?.snapshotMetadata?.snapshotDate`

**Lesson**:
- ✅ **Read type definitions completely before accessing properties**
- ✅ **Check nested object structures**: `snapshotMetadata.snapshotDate` not `snapshotMetadata.asOf`
- ✅ **Use TypeScript's autocomplete to verify property names**

---

### 3. **Accessing Properties at Wrong Nesting Level**
**Error**: Multiple errors like:
- `Property 'rankedTrophies' does not exist on type 'SupabasePlayerProfilePayload'`
- `Property 'tag' does not exist on type 'SupabasePlayerProfilePayload'`
- `Property 'donations' does not exist on type 'SupabasePlayerProfilePayload'`

**Location**: `web-next/src/app/new/player/[tag]/PlayerProfileClient.tsx`

**Problem**:
- Accessing `profile.rankedTrophies` when it should be `profile.summary.rankedTrophies`
- Accessing `profile.tag` when it should be `profile.summary.tag`
- Not understanding the data structure: `SupabasePlayerProfilePayload` has a `summary` property that contains the actual player data

**Fix**: Changed all property access to use the correct nesting:
```typescript
// ❌ WRONG
const trophies = profile?.rankedTrophies ?? 0;
const tag = profile?.tag || '';

// ✅ CORRECT
const trophies = profile?.summary?.rankedTrophies ?? 0;
const tag = profile?.summary?.tag || '';
```

**Lesson**:
- ✅ **Read the FULL type definition before accessing properties**
- ✅ **Check ALL nested properties, not just top-level ones**
- ✅ **Understand the data structure**: `SupabasePlayerProfilePayload = { summary: { ...actual data... } }`
- ✅ **Use TypeScript's type checking**: If it errors, the property path is wrong

---

### 4. **Duplicate Object Properties**
**Error**: `Type error: An object literal cannot have multiple properties with the same name.`

**Location**: `web-next/src/app/new/ui/iconography/page.tsx`

**Problem**:
- Duplicate `spikyball` key in `equipmentIconMap` object
- Copy-paste error that wasn't caught

**Fix**: Removed the duplicate entry

**Lesson**:
- ✅ **Review object literals for duplicate keys**
- ✅ **Use TypeScript strict mode** (catches these at compile time)
- ✅ **Be careful with copy-paste operations**

---

### 5. **Using Wrong Component Props API**
**Error**: Multiple errors like:
- `Property 'variant' does not exist on type 'IntrinsicAttributes & ButtonProps'`
- `Property 'size' does not exist on type 'IntrinsicAttributes & ButtonProps'`

**Locations**: 
- `web-next/src/app/new/war/cwl/day/[day]/page.tsx`
- `web-next/src/app/new/war/cwl/page.tsx`
- `web-next/src/app/new/war/cwl/roster/page.tsx`
- `web-next/src/app/new/player/[tag]/PlayerProfileClient.tsx`

**Problem**:
- Using `variant="outline"` and `size="sm"` props
- The custom `Button` component uses `tone` prop instead of `variant`
- No `size` prop exists; use `className` for sizing

**Fix**: Changed all Button usages:
```typescript
// ❌ WRONG
<Button variant="outline" size="sm">Click me</Button>

// ✅ CORRECT
<Button tone="ghost" className="text-sm">Click me</Button>
```

**Lesson**:
- ✅ **Read component prop definitions before using them**
- ✅ **Check existing usage patterns**: `grep -r "Button" web-next/src/components` to see how it's used elsewhere
- ✅ **Don't assume standard prop names**: Custom components have custom APIs
- ✅ **Use TypeScript errors as guidance**: The error tells you what props are available

---

### 6. **Typo in Variable Names**
**Error**: `Type error: Cannot find name 'remoteHydrated'.`

**Location**: `web-next/src/app/new/war/cwl/roster/page.tsx`

**Problem**:
- Variable declared as `hydrated` but referenced as `remoteHydrated`
- Simple typo that breaks the build

**Fix**: Changed `remoteHydrated.current` to `hydrated.current`

**Lesson**:
- ✅ **Use consistent variable naming**
- ✅ **Let TypeScript catch typos** (it did!)
- ✅ **Use find/replace carefully** to avoid partial replacements

---

## Root Causes & Prevention

### Common Patterns That Lead to Errors:

1. **Not Reading Type Definitions**
   - Developers assume property names without checking
   - Solution: Always read the full type definition before accessing properties

2. **Copy-Paste Without Verification**
   - Copying code from other components without checking prop APIs
   - Solution: Verify component APIs match before copying

3. **Incomplete Refactoring**
   - Leaving dead exports or unused code
   - Solution: Use grep/search to find all usages before removing

4. **Assuming Standard Patterns**
   - Assuming `variant` prop exists on all Button components
   - Solution: Check actual component implementation

5. **Not Using TypeScript Strictly**
   - TypeScript catches these errors, but they weren't caught locally
   - Solution: Run `npm run build` or `tsc --noEmit` before pushing

---

## Pre-Commit Checklist

Before committing code that will be deployed:

- [ ] Run `npm run build` locally to catch TypeScript errors
- [ ] Run `npm run lint` to catch linting issues
- [ ] Search for existing exports before creating new ones: `grep -r "export.*ComponentName"`
- [ ] Read type definitions completely before accessing nested properties
- [ ] Verify component prop APIs match usage (check component definition)
- [ ] Check for duplicate object keys
- [ ] Verify variable names are consistent throughout the file
- [ ] Test the actual functionality, not just that it compiles

---

## Quick Reference: Common Fixes

| Error Pattern | Fix |
|--------------|-----|
| `Property 'X' does not exist` | Read type definition, check nesting level |
| `Cannot find module './X'` | Verify file exists, check export statement |
| `Property 'variant' does not exist` | Check component API, use correct prop name (`tone` for Button) |
| `Duplicate property name` | Remove duplicate key in object literal |
| `Cannot find name 'X'` | Check for typos, verify variable is declared |

---

## The Button Component API (Reference)

The custom `Button` component in this codebase uses:
- `tone` prop: `"default" | "ghost" | "primary" | "danger"` (NOT `variant`)
- No `size` prop: Use `className="text-sm"` or similar for sizing
- Standard props: `onClick`, `disabled`, `className`, `title`, etc.

**Always check the component definition** before using it:
```bash
cat web-next/src/components/new-ui/Button.tsx
```

