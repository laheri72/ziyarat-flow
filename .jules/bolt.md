## 2024-05-24 - React Performance: Redundant synchronous string ops inside list filters
**Learning:** Found an anti-pattern in `src/pages/Dashboard.tsx` and `src/pages/Admin.tsx` where `.filter()` iterates over large arrays and redundantly calculates `searchQuery.toLowerCase()` on every iteration blocking the main thread.
**Action:** Always hoist `searchQuery.toLowerCase()` outside of `.filter()` loops, and aggressively apply `useMemo` for derived states like filtering, grouping, and sorting to prevent unnecessary re-renders when other states update.
