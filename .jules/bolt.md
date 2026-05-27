## 2024-05-27 - [Supabase N+1 Queries in React Maps]
**Learning:** Found multiple instances where `.map()` wraps `supabase` queries inside `Promise.all()`. Since Supabase has rate limits and connection overhead, firing N concurrent queries for related entities creates a massive performance bottleneck as data grows.
**Action:** Always extract foreign keys, dedup using `Set`, query related records in batches (e.g., chunk size 50) using the `.in()` filter, and compute aggregate metrics locally via `Map` objects before mapping over the original array.
