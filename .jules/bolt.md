## 2024-05-18 - [Avoid O(N^2) Complexity in Array Sorts]
**Learning:** Calculating `.filter().length` inside a `.sort()` comparator causes $O(N^2)$ recalculations, as the filter executes on the entire array for every element comparison. This is a significant bottleneck when rendering large dynamic lists.
**Action:** Precompute derived values (such as counts or lengths) into a lookup dictionary (hash map) outside of the `.sort()` operation. Use the dictionary to look up values inside the comparator in $O(1)$ time, maintaining the expected $O(N \log N)$ complexity of the sort operation.
