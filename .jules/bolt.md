## 2025-05-18 - Fix N+1 Query Bottleneck
**Learning:** Using `Promise.all` with `.eq()` for querying aggregates in Supabase leads to N+1 query problems and scaling issues.
**Action:** Instead of making individual queries per related record, fetch relation data in chunks using the `.in()` filter to batch results and then calculate aggregates in memory to drastically reduce query latency.
## 2025-05-18 - Memoize Expensive Array Operations
**Learning:** Deriving filtered and sorted lists on every render cycle causes significant layout and JS execution delays for large datasets.
**Action:** Wrap heavy array transformations (filter/sort) in `useMemo` to cache the result until underlying dependencies change.
