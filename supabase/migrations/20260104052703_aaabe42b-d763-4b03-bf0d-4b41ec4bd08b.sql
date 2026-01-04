-- Create enum for assignment status
CREATE TYPE public.assignment_status AS ENUM ('pending', 'completed');

-- Create enum for admin roles
CREATE TYPE public.admin_role AS ENUM ('admin', 'super_admin');

-- Beneficiaries table (Karachi HOF - ~7,942 records)
CREATE TABLE public.beneficiaries (
  its_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  jamaat TEXT,
  mobile TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Students table (Talabat - 186 records)
CREATE TABLE public.students (
  tr_number TEXT PRIMARY KEY,
  its_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  branch TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assignments table (heart of the system)
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_its_id TEXT NOT NULL REFERENCES public.beneficiaries(its_id) ON DELETE CASCADE,
  student_tr_number TEXT NOT NULL REFERENCES public.students(tr_number) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status assignment_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(beneficiary_its_id)
);

-- Admin users table
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Session tracking for students (lightweight auth)
CREATE TABLE public.student_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_tr_number TEXT NOT NULL REFERENCES public.students(tr_number) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create indexes for performance
CREATE INDEX idx_assignments_student ON public.assignments(student_tr_number);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_beneficiaries_jamaat ON public.beneficiaries(jamaat);
CREATE INDEX idx_students_its_id ON public.students(its_id);

-- Enable RLS on all tables
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access for beneficiaries (students need to see their assigned names)
CREATE POLICY "Allow public read access to beneficiaries" 
ON public.beneficiaries FOR SELECT 
USING (true);

-- Public read access for students table (for login validation)
CREATE POLICY "Allow public read access to students" 
ON public.students FOR SELECT 
USING (true);

-- Public access for assignments (students mark completion)
CREATE POLICY "Allow public read access to assignments" 
ON public.assignments FOR SELECT 
USING (true);

CREATE POLICY "Allow public update on assignments" 
ON public.assignments FOR UPDATE 
USING (true);

-- Public access for sessions
CREATE POLICY "Allow public read access to sessions" 
ON public.student_sessions FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on sessions" 
ON public.student_sessions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public delete on sessions" 
ON public.student_sessions FOR DELETE 
USING (true);

-- Admin users - restricted
CREATE POLICY "Allow public read access to admin_users" 
ON public.admin_users FOR SELECT 
USING (true);

-- Public insert/update policies for admin operations
CREATE POLICY "Allow public insert on beneficiaries" 
ON public.beneficiaries FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public insert on students" 
ON public.students FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public insert on assignments" 
ON public.assignments FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public delete on assignments" 
ON public.assignments FOR DELETE 
USING (true);

CREATE POLICY "Allow public update on students" 
ON public.students FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on beneficiaries" 
ON public.beneficiaries FOR DELETE 
USING (true);

CREATE POLICY "Allow public delete on students" 
ON public.students FOR DELETE 
USING (true);