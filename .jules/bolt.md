## 2024-05-23 - [Optimized Full Table Scans to Chunked IN queries]
**Learning:** Supabase / Postgres fetches that try to fetch the entire table in 1000 row chunks iteratively are a major bottleneck as the table grows, and causes excessive memory usage.
**Action:** When filtering a known set of related rows (like assignments for active students), instead of scanning the whole table, extract the specific foreign keys needed, chunk them, and use an `.in()` filter to query only the necessary records.
