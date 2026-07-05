
## 2024-11-20 - Memoizing heavy data transformations in Dashboard
**Learning:** In `Dashboard.tsx`, complex `.filter()`, `.reduce()`, and `.sort()` chains were being executed on every re-render (which can happen frequently on keystrokes in search inputs).
**Action:** Always wrap heavy synchronous data processing in `useMemo` hooks with tight dependency arrays, and hoist invariant string operations (like `searchQuery.toLowerCase()`) outside of tight inner `.filter()` loops to minimize blocking the main thread.
