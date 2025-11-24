-- Add join_code, is_active, and description columns to classes table
ALTER TABLE public.classes 
ADD COLUMN join_code TEXT UNIQUE,
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN description TEXT;

-- Function to generate a random 6-character alphanumeric code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to set join_code before insert
CREATE OR REPLACE FUNCTION set_join_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.join_code IS NULL THEN
    LOOP
      new_code := generate_join_code();
      SELECT EXISTS(SELECT 1 FROM public.classes WHERE join_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.join_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate join codes
CREATE TRIGGER set_join_code_trigger
BEFORE INSERT ON public.classes
FOR EACH ROW
EXECUTE FUNCTION set_join_code();

-- Update existing classes with join codes
DO $$
DECLARE
  class_record RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR class_record IN SELECT id FROM public.classes WHERE join_code IS NULL LOOP
    LOOP
      new_code := generate_join_code();
      SELECT EXISTS(SELECT 1 FROM public.classes WHERE join_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE public.classes SET join_code = new_code WHERE id = class_record.id;
  END LOOP;
END $$;

-- Update RLS policies for classes to allow students to view active classes by join code
CREATE POLICY "Students can view active classes by join code"
ON public.classes
FOR SELECT
TO authenticated
USING (is_active = true);

-- Allow students to insert into class_students (join classes)
CREATE POLICY "Students can join classes"
ON public.class_students
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());