
-- Create live_sessions table to track teacher's live streaming status
CREATE TABLE public.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  is_live boolean NOT NULL DEFAULT false,
  camera_on boolean NOT NULL DEFAULT false,
  mic_on boolean NOT NULL DEFAULT false,
  screen_sharing boolean NOT NULL DEFAULT false,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(class_id)
);

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own live sessions
CREATE POLICY "Teachers can manage their live sessions"
ON public.live_sessions
FOR ALL
USING (teacher_id = auth.uid());

-- Students can view live sessions for their enrolled classes
CREATE POLICY "Students can view live sessions for enrolled classes"
ON public.live_sessions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM class_students
  WHERE class_students.class_id = live_sessions.class_id
  AND class_students.student_id = auth.uid()
));

-- Enable realtime for live_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;

-- Add avatar_url to profiles if it doesn't have proper storage setup
-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
