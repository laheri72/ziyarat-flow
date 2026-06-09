
## 2026-06-09 - Memoization of Data Transformations in React
**Learning:** In a dashboard processing thousands of records locally, unmemoized data transformations (like sorting, grouping, and filtering mapped elements) inside a React render function significantly block the main thread and degrade input responsiveness (e.g., search bars).
**Action:** Use `useMemo` to wrap all heavy synchronous data processing steps when dealing with collections directly rendered from application state, and ensure operations like `.toLowerCase()` are pulled outside loops.
