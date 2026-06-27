
## 2024-05-18 - Hoisting constant derivations out of tight loops
**Learning:** In React components with search filtering, putting `.toLowerCase()` on the search query *inside* the array `.filter()` callback means the exact same string operation happens for every single element in the array, blocking the main thread.
**Action:** Always hoist derivations like `searchQuery.toLowerCase()` to outside the loop/filter callback. Pair with `useMemo` to skip running the filter block entirely if the query or underlying array hasn't changed.
