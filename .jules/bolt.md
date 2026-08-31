## 2024-05-18 - Optimized Filtering logic

**Learning:** Extracted multiple redundant list filterings into a single `useMemo` call.
**Action:** Move repetitive filtering operations on arrays into `useMemo` blocks so they only recalculate when dependencies change.
