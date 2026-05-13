## 2024-05-18 - React Performance Optimizations
**Learning:** In typical React applications rendering lists of interactive items, failing to wrap list components in `React.memo` and failing to memoize callbacks (`useCallback`) causes $O(n)$ re-renders of list items for independent state changes in the parent. Also, doing heavy array transformations (e.g. nested array filters and maps) on every render in a parent component is a performance bottleneck.
**Action:** Use `React.memo` for list items, `useCallback` for event handlers passed to them, and `useMemo` for derived heavy computations.
