## 2024-06-13 - [Performance Optimization] Missing useMemo for List Filtering
**Learning:** React components containing list filtering and sorting, such as `Dashboard` and `Admin`, frequently recalculate derived state on every render, which can lead to performance degradation on larger lists.
**Action:** When working on React components with heavy list filtering or sorting, ensure `useMemo` is applied to memoize the computed lists to prevent unnecessary processing blockages on each render.
