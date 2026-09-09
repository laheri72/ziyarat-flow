## 2025-01-20 - Prevent O(N²) sorting complexity
**Learning:** Calling array iteration methods like `.filter()` inside `.sort()` comparators results in O(N²) complexity.
**Action:** Precompute derived values (such as counts) into a lookup dictionary before the sort operation to maintain O(N log N) performance.
