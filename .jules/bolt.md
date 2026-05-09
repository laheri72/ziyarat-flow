## 2026-05-09 - [Memoizing derived state in complex dashboards]
**Learning:** React components with a high amount of complex derived state (like filtering, grouping, and sorting large arrays based on search queries) often re-run these expensive array methods on every tiny unrelated state change (e.g., toggling a switch or requesting data).
**Action:** Always verify if complex array transformations in top-level components can be wrapped in `useMemo` hooks to avoid unnecessary re-renders when other state changes.
