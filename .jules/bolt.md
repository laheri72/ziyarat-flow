## 2024-05-18 - Dashboard Sorting Bottleneck
**Learning:** Filtering arrays within a sort comparator leads to O(N * N log N) complexity, which is highly inefficient for large lists. Pre-calculating counts avoids this issue.
**Action:** Always hoist O(N) operations like filter or map out of sort comparators.