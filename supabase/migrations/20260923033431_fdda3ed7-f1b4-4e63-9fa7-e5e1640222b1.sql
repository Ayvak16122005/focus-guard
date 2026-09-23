CREATE OR REPLACE FUNCTION public.lookup_class_by_code(_code text)
RETURNS TABLE (id uuid, name text, description text, teacher_name text, student_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         c.name,
         c.description,
         p.full_name,
         (SELECT count(*) FROM public.class_students cs WHERE cs.class_id = c.id)
  FROM public.classes c
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  WHERE upper(c.join_code) = upper(trim(_code))
    AND c.is_active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_class_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated;