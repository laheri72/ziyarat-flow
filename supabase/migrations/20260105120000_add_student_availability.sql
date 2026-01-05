-- Add availability status for students (Mumbai presence)
ALTER TABLE students 
ADD COLUMN available_in_mumbai BOOLEAN DEFAULT false,
ADD COLUMN availability_updated_at TIMESTAMP WITH TIME ZONE;

-- Add a settings table for admin to set current event for availability check
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default current event setting
INSERT INTO app_settings (setting_key, setting_value) 
VALUES ('current_event_for_availability', 'Urus Mubarak 1449')
ON CONFLICT (setting_key) DO NOTHING;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_students_availability ON students(available_in_mumbai);
