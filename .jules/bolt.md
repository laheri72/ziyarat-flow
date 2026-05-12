
## 2024-05-24 - React List Rendering Performance
**Learning:** In complex React applications, heavy computations like filtering and grouping lists inside functional components can become significant performance bottlenecks, causing sluggish UI updates especially on large datasets. Additionally, rendering large lists where each item is a complex component can lead to unnecessary re-renders of the entire list when only a single item changes.
**Action:** Always wrap heavy data transformations (filtering, sorting, grouping) with `useMemo`. Memoize list item components using `React.memo` and ensure callbacks passed to them are stabilized using `useCallback` to prevent breaking the memoization.
