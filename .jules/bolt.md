## 2025-01-01 - Created\n**Learning:** Initial\n**Action:** None

## 2025-01-13 - O(N) database data fetch memory bloat
**Learning:** Found anti-pattern: `while(true)` fetching `range(0, 1000)` until all data is in memory, for multiple tables, just to do an anti-join (`!set.has(id)`). This causes extreme memory usage and data transfer as the database grows.
**Action:** Replace `while(true)` full table fetches with chunked fetches of beneficiaries, using `in(...)` clause to query assignments only for the chunk's IDs to build a smaller exclusion set and stream the final unassigned list, drastically lowering memory usage and data transfer on large lists.
