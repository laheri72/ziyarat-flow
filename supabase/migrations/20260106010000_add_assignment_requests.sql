-- Create assignment_requests table (for students requesting new assignments)
create table if not exists public.assignment_requests (
  id uuid primary key default gen_random_uuid(),
  student_tr_number text not null references public.students(tr_number) on delete cascade,
  event_tag text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone,
  processed_by text
);

-- Add RLS policies
alter table public.assignment_requests enable row level security;

-- Students can view their own requests
create policy "Students can view own assignment requests"
  on public.assignment_requests for select
  using (true);

-- Students can insert their own requests
create policy "Students can create assignment requests"
  on public.assignment_requests for insert
  with check (true);

-- Create index for faster queries
create index if not exists idx_assignment_requests_student on public.assignment_requests(student_tr_number);
create index if not exists idx_assignment_requests_status on public.assignment_requests(status);
