-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policy: users can view their own profile
-- and teachers can view profiles of students in their classes
CREATE POLICY "Users can view own and class profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 
    FROM class_students cs
    JOIN classes c ON cs.class_id = c.id
    WHERE cs.student_id = profiles.id 
    AND c.teacher_id = auth.uid()
  )
);