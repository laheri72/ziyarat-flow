-- Add event_tag column to assignments table
ALTER TABLE public.assignments ADD COLUMN event_tag TEXT;

-- Create index for faster filtering by event
CREATE INDEX idx_assignments_event_tag ON public.assignments(event_tag);
