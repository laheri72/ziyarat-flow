## 2025-05-21 - List Rendering Optimizations
**Learning:** When dealing with long lists in React that require multiple O(n) filtering/grouping passes per render, memoizing the transformations and child rows yields significant performance wins during unrelated state updates.
**Action:** Always pair `useCallback` on list item handlers with `React.memo` on the list item component to fully bypass the render phase for unchanged children.
