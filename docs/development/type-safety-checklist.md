# Type Safety Playbook

> Living guide to keep rapid development aligned with TypeScript’s guardrails. Use this before, during, and after feature work—especially when prototyping quickly.

## Why This Exists

The last promotion was delayed because unchecked type drift crept into the build. We moved fast, but skipped the guardrails TypeScript provides. The result: wrong imports, mismatched function signatures, missing properties, and optimistic assumptions about available methods.

Treat this document as the baseline process to avoid repeating those pitfalls.

---

## Pre-Development Checklist

- **Confirm strict mode** – Ensure `tsconfig.json` keeps `"strict": true` (or stricter). Do not disable for local work.
- **Trace dependencies** – Identify which modules, services, or API responses the feature will touch. Note type ownership for each.
- **Review types ahead of time** – Open the relevant type definitions (`src/types`, feature-specific interfaces) before coding to avoid guessing property names.
- **Plan data flow** – Sketch the function signature(s) you need. Include expected parameters, return types, and null/undefined behaviour.

---

## Development Workflow

1. **Import verification**
   - Use editor auto-complete or `Go to definition` to confirm you import from the source of truth.
   - Avoid copy/paste imports without checking the exported names.
2. **Function signature confirmation**
   - Inspect the actual implementation (or interface) before calling it.
   - If the signature needs to change, update the definition first so the compiler guides the callers.
3. **Incremental typing**
   - When adding new properties, update the shared types immediately.
   - Prefer `type`/`interface` extensions over `any`. If you must use `TODO` types, leave a comment with the removal plan.
4. **Local builds early & often**
   - Run `npm run build` (or `npm run lint && npm run typecheck`) after each logical chunk.
   - Fix every error before writing new code; do not pile up red squiggles.
5. **Feature flags & migrations**
   - When skipping UI wiring, still expose the type scaffolding so later updates are additive, not corrective.

---

## Testing Protocol

- **Run the type checker** – `npm run typecheck` (or `tsc --noEmit`) before pushing.
- **Execute the build** – Catch bundler-level issues early (`npm run build`).
- **Smoke the feature** – Open the affected screen and trigger the new code paths. Watch console for runtime warnings.
- **Snapshot dependencies** – If the change touches data fetching or transforms, add/refresh Jest or integration tests covering new type expectations.

---

## Code Review Checklist

- Imports reference the correct module (no stray relative paths to deprecated files).
- Function calls align with the declared signature (parameter order, required flags, return handling).
- Type definitions include every property the feature touches—no implicit `any` or unknown spreads.
- Newly added props are backward compatible (optional when appropriate, with safe defaults).
- Type assertions (`as`) have comments or are removed in favour of proper typing.
- Tests exist (or are updated) for new behaviours, especially around data transforms.

---

## Red Flags to Halt & Fix Immediately

- Adding `// @ts-ignore`, `any`, or casting to `unknown` without a Jira/Trello ticket or removal plan.
- Copying a helper from another component and editing it inline instead of extracting shared logic.
- Using `?.` or default values to suppress a type error without confirming the upstream contract.
- Ignoring failed `npm run build` or `npm run typecheck` output “just to keep working.”
- Referencing methods or properties you haven’t seen defined in the source file.

---

## Specific Improvements Going Forward

1. **Type safety first**
   - Keep strict mode on; never downgrade it to unblock a build.
   - Use discriminated unions and enums where appropriate to encode business rules.
2. **Import verification**
   - Rely on absolute import aliases (`@/…`) to reduce path errors.
   - Delete unused imports immediately to surface missing exports sooner.
3. **Function signature vigilance**
   - When you touch an API, update the client and server types together.
   - Document optional parameters and defaults in the function JSDoc.
4. **Incremental type updates**
   - Extend `src/types` or module-local interfaces as soon as new data fields appear.
   - Regenerate API response fixtures or mock data to match the new shape.
5. **Build discipline**
   - Incorporate `npm run typecheck` and `npm run build` into pre-commit hooks or CI gates.
   - Treat any red output as a stop sign, not a warning.

---

## Bottom Line

Rapid prototypes still deserve type safety. Running the checker early, fixing issues on the spot, and keeping imports/types honest preserves velocity **and** reliability. Follow this playbook whenever you start new feature work or revive dormant branches.
