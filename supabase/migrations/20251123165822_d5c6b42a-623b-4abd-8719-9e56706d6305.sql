-- Drop the overly permissive policy that allows any teacher to view all metrics
DROP POLICY IF EXISTS "Teachers can view class metrics" ON public.attention_metrics;

-- Create restrictive policy: teachers can ONLY view metrics for students in their classes
CREATE POLICY "Teachers can view class metrics" ON public.attention_metrics
FOR SELECT USING (
  EXISTS (
    SELECT 1 
    FROM monitoring_sessions ms
    JOIN classes c ON ms.class_id = c.id
    WHERE ms.id = attention_metrics.session_id 
    AND c.teacher_id = auth.uid()
  )
);