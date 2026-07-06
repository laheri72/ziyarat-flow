
## 2024-05-18 - React Performance: Memoization of Data Transformations
**Learning:** The Dashboard and Admin pages were performing O(N) filtering, O(N log N) sorting, and O(N) array grouping synchronously on every render directly in the component body. This blocks the main thread, leading to jittery user interfaces as lists grow large.
**Action:** Use `useMemo` for filtering, grouping, and sorting operations. When hoisting string operations (e.g. `.toLowerCase()`) outside the map/filter loops, ensure variables are properly checked for nullability, and remember to always create a shallow copy (`[...array].sort()`) when applying sorting logic within a useMemo block.
