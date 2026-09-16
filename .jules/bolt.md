## 2024-05-24 - Precomputing derived values before sorting
**Learning:** Calling array iteration methods like `.filter()` inside `.sort()` comparators results in O(N^2) complexity, significantly degrading frontend performance for large lists.
**Action:** Always precompute derived values (such as counts) into a lookup dictionary before the sort operation to maintain O(N log N) performance.

## 2024-05-24 - Memoizing component list derived state
**Learning:** Computing lengths using `.filter().length` inline in the render method forces a recreation of the filtered array on every render, causing O(N) operations.
**Action:** Use `useMemo` to memoize the computed lengths when the dependency arrays change to prevent recalculating values unnecessarily.
