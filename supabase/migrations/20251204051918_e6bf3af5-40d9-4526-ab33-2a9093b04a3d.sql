-- Create table for student join requests (approval system)
CREATE TABLE public.join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(class_id, student_id)
);

-- Create table for broadcast messages
CREATE TABLE public.broadcast_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Join requests policies
CREATE POLICY "Students can create their own join requests"
ON public.join_requests FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own join requests"
ON public.join_requests FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Teachers can view join requests for their classes"
ON public.join_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM classes WHERE classes.id = join_requests.class_id AND classes.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can update join requests for their classes"
ON public.join_requests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM classes WHERE classes.id = join_requests.class_id AND classes.teacher_id = auth.uid()
));

-- Broadcast messages policies
CREATE POLICY "Teachers can create broadcast messages"
ON public.broadcast_messages FOR INSERT
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students can view broadcast messages for their enrolled classes"
ON public.broadcast_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM class_students WHERE class_students.class_id = broadcast_messages.class_id AND class_students.student_id = auth.uid()
));

CREATE POLICY "Teachers can view their broadcast messages"
ON public.broadcast_messages FOR SELECT
USING (teacher_id = auth.uid());

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;