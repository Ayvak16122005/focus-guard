
-- 1. Fix profiles: Drop and recreate policy to ensure auth is required
DROP POLICY IF EXISTS "Authenticated users can view own and class profiles" ON public.profiles;

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

-- 2. Fix classes: Replace permissive policy with restricted one
DROP POLICY IF EXISTS "Students can view active classes by join code" ON public.classes;

CREATE POLICY "Students can view enrolled classes" 
ON public.classes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_students 
      WHERE class_students.class_id = classes.id 
      AND class_students.student_id = auth.uid()
    )
  )
);

-- 3. Fix monitoring_sessions: Remove the teacher role bypass
DROP POLICY IF EXISTS "Teachers can view class sessions" ON public.monitoring_sessions;

CREATE POLICY "Teachers can view class sessions" 
ON public.monitoring_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM classes
    WHERE classes.id = monitoring_sessions.class_id 
    AND classes.teacher_id = auth.uid()
  )
);

-- 4. Fix alerts: Remove the teacher role bypass
DROP POLICY IF EXISTS "Teachers can view class alerts" ON public.alerts;
DROP POLICY IF EXISTS "Teachers can acknowledge alerts" ON public.alerts;

CREATE POLICY "Teachers can view class alerts" 
ON public.alerts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM monitoring_sessions ms
    JOIN classes c ON ms.class_id = c.id
    WHERE ms.id = alerts.session_id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can acknowledge alerts" 
ON public.alerts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM monitoring_sessions ms
    JOIN classes c ON ms.class_id = c.id
    WHERE ms.id = alerts.session_id AND c.teacher_id = auth.uid()
  )
);

-- 5. Fix user_roles: Add explicit INSERT policy for admins only
CREATE POLICY "Only admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
