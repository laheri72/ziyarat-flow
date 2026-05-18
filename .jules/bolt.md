## 2024-05-24 - React List Memoization Gotcha
**Learning:** When memoizing a list item component (`React.memo`), it's completely ineffective unless the callbacks passed as props are also memoized (`useCallback`). In `Dashboard.tsx`, memoizing `AssignmentRow` required stabilizing the `toggleStatus` callback from `useStudentAssignments.ts`.
**Action:** Always verify the stability of prop references (functions, objects, arrays) passed to a `React.memo` component, as inline or unstabilized props will defeat the memoization.
