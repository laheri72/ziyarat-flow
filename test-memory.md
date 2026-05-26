The application has major N+1 query performance issues in `Admin.tsx`, specifically around dashboard stats fetching:
1. `fetchStudentProgress` fetches all students, then loops through them running two exact count queries (`Promise.all`) per student to count assigned and completed assignments. This results in 2 * N queries (where N is the number of active students).
2. `fetchUnassignmentRequests` fetches requests, then loops through them running a `select('name')` query and a count query per request.
3. `fetchAssignmentRequests` is doing the same thing.

Instead of running queries inside a loop (`progressPromises = students.map(async (student) => ...`), Supabase offers aggregate features, or we can fetch the entire dataset (e.g. `select('student_tr_number, status')` from `assignments` once) and then count them locally, which is much faster. Let's see how `assignments` are handled locally.
