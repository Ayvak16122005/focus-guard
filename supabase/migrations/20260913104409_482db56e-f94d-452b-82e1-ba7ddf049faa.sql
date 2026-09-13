
CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class_id AND c.teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_students cs WHERE cs.class_id = _class_id AND cs.student_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.shares_class_with(_other_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students a
    JOIN public.class_students b ON a.class_id = b.class_id
    WHERE a.student_id = _user_id AND b.student_id = _other_id
  ) OR EXISTS (
    SELECT 1 FROM public.class_students a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.student_id = _user_id AND c.teacher_id = _other_id
  ) OR EXISTS (
    SELECT 1 FROM public.class_students a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.student_id = _other_id AND c.teacher_id = _user_id
  )
$$;

-- classes
DROP POLICY IF EXISTS "Students can view enrolled classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can manage their classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their classes" ON public.classes;

CREATE POLICY "Teachers manage own classes" ON public.classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view classes" ON public.classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_class_member(id, auth.uid()));

-- class_students
DROP POLICY IF EXISTS "Students can view their enrollments" ON public.class_students;
DROP POLICY IF EXISTS "Teachers can manage their class students" ON public.class_students;
DROP POLICY IF EXISTS "Students can join classes" ON public.class_students;

CREATE POLICY "Students can join classes" ON public.class_students FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "View enrollments" ON public.class_students FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "Teachers update enrollments" ON public.class_students FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "Teachers delete enrollments" ON public.class_students FOR DELETE TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Authenticated users can view own and class profiles" ON public.profiles;
CREATE POLICY "View own and class profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.shares_class_with(id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.classes, public.class_students, public.profiles TO service_role;
