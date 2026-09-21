## 2024-05-24 - Precomputing Filtered Arrays Before Sort Operations
**Learning:** Found an O(N^2) complexity issue inside a `useMemo` React hook where `.filter().length` was used directly inside the `.sort()` comparator loop.
**Action:** When filtering counts dynamically before sorting an object/array, precompute the length dynamically inside a hashmap lookup dictionary rather than executing repetitive `.filter().length` within the comparator, keeping the complexity at O(N log N).
