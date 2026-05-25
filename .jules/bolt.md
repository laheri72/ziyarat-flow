## 2024-05-25 - React Performance in Ziyarat List Rendering
**Learning:** Frequent toggling of assignment statuses without memoized data transformations and list item components causes unnecessary re-renders of the entire list.
**Action:** Always wrap lists items with `React.memo` and use `useMemo`/`useCallback` for data transformations and handlers in performance-critical views like the Ziyarat list.
