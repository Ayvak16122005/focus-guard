-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- Create enum for attention status
CREATE TYPE public.attention_status AS ENUM ('focused', 'distracted', 'drowsy');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create class_students junction table
CREATE TABLE public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, student_id)
);

-- Create monitoring_sessions table
CREATE TABLE public.monitoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_duration_seconds INTEGER DEFAULT 0,
  average_attention_score INTEGER,
  total_distraction_time_seconds INTEGER DEFAULT 0,
  tab_switches INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);

-- Create attention_metrics table for real-time tracking
CREATE TABLE public.attention_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attention_score INTEGER NOT NULL,
  status attention_status NOT NULL,
  face_detected BOOLEAN NOT NULL
);

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for classes
CREATE POLICY "Teachers can view their classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage their classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for class_students
CREATE POLICY "Students can view their enrollments"
  ON public.class_students FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid()
  ));

CREATE POLICY "Teachers can manage their class students"
  ON public.class_students FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid()
  ));

-- RLS Policies for monitoring_sessions
CREATE POLICY "Students can view own sessions"
  ON public.monitoring_sessions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own sessions"
  ON public.monitoring_sessions FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own sessions"
  ON public.monitoring_sessions FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view class sessions"
  ON public.monitoring_sessions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for attention_metrics
CREATE POLICY "Students can create own metrics"
  ON public.attention_metrics FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.monitoring_sessions 
    WHERE id = session_id AND student_id = auth.uid()
  ));

CREATE POLICY "Students can view own metrics"
  ON public.attention_metrics FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.monitoring_sessions 
    WHERE id = session_id AND student_id = auth.uid()
  ));

CREATE POLICY "Teachers can view class metrics"
  ON public.attention_metrics FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.monitoring_sessions ms
    JOIN public.classes c ON ms.class_id = c.id
    WHERE ms.id = session_id AND c.teacher_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for alerts
CREATE POLICY "Students can view own alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own alerts"
  ON public.alerts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view class alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.monitoring_sessions ms
    JOIN public.classes c ON ms.class_id = c.id
    WHERE ms.id = session_id AND c.teacher_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can acknowledge alerts"
  ON public.alerts FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.monitoring_sessions ms
    JOIN public.classes c ON ms.class_id = c.id
    WHERE ms.id = session_id AND c.teacher_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'teacher'));

-- Create trigger to automatically create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attention_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;