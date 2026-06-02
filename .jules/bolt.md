## 2026-06-02 - [Memoize custom hook callbacks & heavy renders]
**Learning:** In Dashboard.tsx, complex data derivations (filtering, grouping) are recalculated entirely on every render (e.g., when a user types in a search query). Moreover, `toggleStatus` from `useStudentAssignments` wasn't memoized, forcing child components consuming it to re-render.
**Action:** Pair `useCallback` on hook functions with `useMemo` on heavy array operations and `React.memo` on list item components for comprehensive render optimization.
