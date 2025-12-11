import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LiveSessionState {
  isLive: boolean;
  cameraOn: boolean;
  micOn: boolean;
  screenSharing: boolean;
  startedAt: string | null;
}

export const useLiveSession = (classId: string) => {
  const [sessionState, setSessionState] = useState<LiveSessionState>({
    isLive: false,
    cameraOn: false,
    micOn: false,
    screenSharing: false,
    startedAt: null,
  });

  // Fetch initial state
  useEffect(() => {
    const fetchSessionState = async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("class_id", classId)
        .single();

      if (data) {
        setSessionState({
          isLive: data.is_live,
          cameraOn: data.camera_on,
          micOn: data.mic_on,
          screenSharing: data.screen_sharing,
          startedAt: data.started_at,
        });
      }
    };

    if (classId) {
      fetchSessionState();
    }
  }, [classId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel(`live-session-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_sessions",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSessionState({
              isLive: false,
              cameraOn: false,
              micOn: false,
              screenSharing: false,
              startedAt: null,
            });
          } else {
            const data = payload.new as any;
            setSessionState({
              isLive: data.is_live,
              cameraOn: data.camera_on,
              micOn: data.mic_on,
              screenSharing: data.screen_sharing,
              startedAt: data.started_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  // Update session state
  const updateSession = async (updates: Partial<LiveSessionState>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dbUpdates: any = {};
    if (updates.isLive !== undefined) dbUpdates.is_live = updates.isLive;
    if (updates.cameraOn !== undefined) dbUpdates.camera_on = updates.cameraOn;
    if (updates.micOn !== undefined) dbUpdates.mic_on = updates.micOn;
    if (updates.screenSharing !== undefined) dbUpdates.screen_sharing = updates.screenSharing;
    if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
    dbUpdates.updated_at = new Date().toISOString();

    // Upsert the session
    const { error } = await supabase
      .from("live_sessions")
      .upsert({
        class_id: classId,
        teacher_id: user.id,
        ...dbUpdates,
      }, {
        onConflict: "class_id",
      });

    if (!error) {
      setSessionState(prev => ({ ...prev, ...updates }));
    }

    return error;
  };

  const startSession = async () => {
    return updateSession({
      isLive: true,
      startedAt: new Date().toISOString(),
    });
  };

  const endSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("live_sessions")
      .update({
        is_live: false,
        camera_on: false,
        mic_on: false,
        screen_sharing: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("class_id", classId);

    if (!error) {
      setSessionState({
        isLive: false,
        cameraOn: false,
        micOn: false,
        screenSharing: false,
        startedAt: null,
      });
    }

    return error;
  };

  return {
    ...sessionState,
    updateSession,
    startSession,
    endSession,
  };
};
