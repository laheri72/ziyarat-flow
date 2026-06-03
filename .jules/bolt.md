## 2026-06-03 - Supabase N+1 Queries
**Learning:** Found N+1 query patterns in Admin.tsx where `Promise.all(students.map(async (student) => ...))` executes multiple Supabase queries per student/request (e.g., in `fetchStudentProgress`, `fetchUnassignmentRequests`, `fetchAssignmentRequests`). This scales poorly with large data.
**Action:** Extract foreign keys, perform a single batch query using `.in('field', ids)`, and aggregate results locally in a Map or object.
