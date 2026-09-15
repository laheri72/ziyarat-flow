## 2024-05-18 - Optimize nested array iterations inside sort comparator
**Learning:** Found a case in `Dashboard.tsx` where `.filter()` was called inside a `.sort()` comparator, resulting in O(N^2) complexity. This happens frequently when sorting based on derived metrics like "pending counts".
**Action:** Always precompute derived metrics into a lookup object/map before sorting an array to maintain O(N log N) performance.
