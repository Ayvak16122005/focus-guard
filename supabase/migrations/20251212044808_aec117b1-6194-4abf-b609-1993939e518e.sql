-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view own and class profiles" ON public.profiles;

-- Create a new policy that requires authentication and restricts access
CREATE POLICY "Authenticated users can view own and class profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1
      FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.student_id = profiles.id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.class_id IN (
        SELECT class_id FROM class_students WHERE student_id = auth.uid()
      ) AND (profiles.id = c.teacher_id OR cs.student_id = profiles.id)
    )
  )
);