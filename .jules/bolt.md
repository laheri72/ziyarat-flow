## 2024-05-24 - N+1 Query Anti-Pattern in React Data Fetching
**Learning:** Found an N+1 query bottleneck in `fetchStudentProgress` where it fired two parallel DB queries per row via a loop over students instead of a single batched query to gather counts. It scales linearly with O(N) network requests, exhausting connection pools.
**Action:** When fetching aggregate stats (e.g., assignment completion per user), fetch the raw data in chunks (batch size 500) and perform aggregations using an in-memory Map, effectively reducing network requests to O(1) chunks.
