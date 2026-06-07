## 2024-05-18 - React List Render Optimization
**Learning:** Heavy data transformations like filtering, sorting, and grouping in React components without memoization (especially within lists and search inputs) cause significant UI lag and unnecessary re-renders when local state changes (e.g., keystrokes).
**Action:** Always wrap heavy computations like `.filter().sort()` in `useMemo`, and wrap list item components in `React.memo` paired with `useCallback` for stable function props to prevent large-scale DOM updates during frequent state changes.
