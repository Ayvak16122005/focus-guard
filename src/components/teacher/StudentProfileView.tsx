import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Clock, 
  Eye, 
  AlertTriangle, 
  Calendar,
  X,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { format } from "date-fns";

interface StudentProfileViewProps {
  studentId: string;
  classId: string;
  onClose: () => void;
}

const StudentProfileView = ({ studentId, classId, onClose }: StudentProfileViewProps) => {
  // Fetch student profile
  const { data: profile } = useQuery({
    queryKey: ["student-profile-view", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch student sessions for this class
  const { data: sessions } = useQuery({
    queryKey: ["student-class-sessions", studentId, classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_sessions")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch student alerts for this class
  const { data: alerts } = useQuery({
    queryKey: ["student-alerts", studentId, classId],
    queryFn: async () => {
      const sessionIds = sessions?.map(s => s.id) || [];
      if (sessionIds.length === 0) return [];

      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!sessions,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0m";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const totalSessions = sessions?.length || 0;
  const totalDuration = sessions?.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0) || 0;
  const avgAttention = sessions?.length 
    ? Math.round(sessions.reduce((sum, s) => sum + (s.average_attention_score || 0), 0) / sessions.length)
    : 0;
  const totalAlerts = alerts?.length || 0;
  const totalTabSwitches = sessions?.reduce((sum, s) => sum + (s.tab_switches || 0), 0) || 0;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Student Profile
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student Info */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">{profile?.full_name || "Unknown"}</h3>
            <Badge variant="secondary">Student</Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{formatDuration(totalDuration)}</p>
            <p className="text-xs text-muted-foreground">Total Time</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Eye className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="flex items-center justify-center gap-1">
              <p className="text-lg font-bold">{avgAttention}%</p>
              {avgAttention >= 70 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Avg Attention</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-warning mb-1" />
            <p className="text-lg font-bold">{totalAlerts}</p>
            <p className="text-xs text-muted-foreground">Alerts</p>
          </div>
        </div>

        {/* Tab Switches */}
        <div className="bg-destructive/10 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tab/App Switches</span>
            <Badge variant="destructive">{totalTabSwitches}</Badge>
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <h4 className="font-medium mb-2">Recent Sessions</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {sessions && sessions.length > 0 ? (
              sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {format(new Date(session.started_at), "MMM dd, yyyy")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(session.started_at), "hh:mm a")} - 
                      {session.ended_at 
                        ? format(new Date(session.ended_at), " hh:mm a")
                        : " Active"}
                    </p>
                  </div>
                  <Badge variant={session.average_attention_score && session.average_attention_score >= 70 ? "default" : "destructive"}>
                    {session.average_attention_score || 0}%
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No sessions yet</p>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <h4 className="font-medium mb-2">Recent Alerts</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {alerts && alerts.length > 0 ? (
              alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2 bg-destructive/10 rounded"
                >
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{alert.alert_type}</p>
                    <p className="text-muted-foreground text-xs">{alert.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No alerts</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentProfileView;
