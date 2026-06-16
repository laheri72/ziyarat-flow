
## 2024-05-18 - [Memoizing Heavy Array Transformations in React List Views]
**Learning:** In list views with heavy filtering and sorting logic (e.g. `filteredAssignments` in Dashboard and `filteredProgress` in Admin), computing arrays synchronously on every render blocks the main thread. Additionally, string operations like `.toLowerCase()` inside loop predicates cause excessive redundant CPU usage.
**Action:** Extract string conversions outside loop bodies, use ternary fallbacks to handle nulls, and wrap computationally expensive array transformations in `useMemo` hooks with tight dependency arrays to avoid re-evaluating arrays on unrelated component state updates.
