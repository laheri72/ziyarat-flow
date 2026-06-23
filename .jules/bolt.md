## 2025-06-23 - Memoization and Hoisting for Filtering Operations
**Learning:** In React components that render large lists (like `Dashboard` and `Admin`), synchronous string operations (like `toLowerCase()`) inside `.filter()` loops run on every render and block the main thread.
**Action:** Always hoist static string transformations out of filtering loops, and use `useMemo` to cache the derived data arrays, minimizing unnecessary recalculations across renders.
