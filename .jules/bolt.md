## 2026-07-07 - Hoisting string operations out of loop

**Learning:** In a codebase frequently rendering and filtering large lists synchronously during the React render cycle, calling `String.prototype.toLowerCase()` inside a `.filter` block blocks the main thread unnecessarily because the query term is static across all elements.
**Action:** Extract loop-invariant string manipulations (like `toLowerCase()` on search queries) outside the array iteration callback to minimize per-element overhead, and pair it with `useMemo`.
