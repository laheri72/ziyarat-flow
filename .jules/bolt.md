## 2026-05-26 - Resolving Supabase N+1 Queries
**Learning:** In a Supabase React dashboard, counting exact queries per user in a loop using `Promise.all` causes N+1 queries. Even `Promise.all` executes N requests against the DB which can be catastrophic.
**Action:** Always batch fetch related IDs using `.in('column', [chunks])` in batches of 500. Count items locally in a Javascript `Map` and enrich arrays without DB looping.
