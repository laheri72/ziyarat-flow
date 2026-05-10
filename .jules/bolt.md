## 2024-05-10 - [Optimize expensive filtering and grouping operations in React components]
**Learning:** Found significant performance bottlenecks in Dashboard and Admin components where large arrays were being filtered, reduced, and sorted on every re-render, despite not changing often.
**Action:** Use React.useMemo to memoize expensive computations like filtering arrays and grouping items, reducing unnecessary calculations during re-renders.
