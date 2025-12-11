import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Download, 
  Clock, 
  LogIn, 
  LogOut, 
  Eye, 
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

const SessionReport = () => {
  const navigate = useNavigate();
  const { classId } = useParams();

  // Fetch class info
  const { data: classData } = useQuery({
    queryKey: ["class-report", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all sessions for the class
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["class-sessions-report", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_sessions")
        .select(`
          *,
          profiles!monitoring_sessions_student_id_fkey(full_name, avatar_url)
        `)
        .eq("class_id", classId)
        .order("started_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch alerts for the class
  const { data: alerts } = useQuery({
    queryKey: ["class-alerts-report", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          *,
          monitoring_sessions!alerts_session_id_fkey(
            class_id,
            profiles!monitoring_sessions_student_id_fkey(full_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data?.filter(a => a.monitoring_sessions?.class_id === classId) || [];
    },
  });

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "hh:mm:ss a");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "active") {
      return <Badge className="bg-success text-success-foreground">Active</Badge>;
    }
    return <Badge variant="secondary">Ended</Badge>;
  };

  const getAttentionBadge = (score: number | null) => {
    if (!score) return <Badge variant="secondary">N/A</Badge>;
    if (score >= 80) return <Badge className="bg-success text-success-foreground">{score}%</Badge>;
    if (score >= 60) return <Badge className="bg-warning text-warning-foreground">{score}%</Badge>;
    return <Badge variant="destructive">{score}%</Badge>;
  };

  // Calculate aggregate statistics
  const totalStudents = new Set(sessions?.map(s => s.student_id)).size;
  const totalSessions = sessions?.length || 0;
  const avgAttention = sessions?.length 
    ? Math.round(sessions.reduce((sum, s) => sum + (s.average_attention_score || 0), 0) / sessions.length)
    : 0;
  const totalAlerts = alerts?.length || 0;

  // Export to CSV
  const exportToCSV = () => {
    if (!sessions) return;

    const csvContent = [
      ["Student Name", "Login Time", "Logout Time", "Duration", "Avg Attention", "Tab Switches", "Alerts", "Status"].join(","),
      ...sessions.map(s => [
        s.profiles?.full_name || "Unknown",
        s.started_at ? format(new Date(s.started_at), "yyyy-MM-dd HH:mm:ss") : "-",
        s.ended_at ? format(new Date(s.ended_at), "yyyy-MM-dd HH:mm:ss") : "-",
        formatDuration(s.total_duration_seconds),
        s.average_attention_score || 0,
        s.tab_switches || 0,
        alerts?.filter(a => a.session_id === s.id).length || 0,
        s.status || "unknown"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${classData?.name || "class"}-attendance-report.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Session Report: {classData?.name}
              </h1>
              <p className="text-muted-foreground">Attendance and attention analytics</p>
            </div>
          </div>
          <Button onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalSessions}</p>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">{avgAttention}%</p>
                  <p className="text-sm text-muted-foreground">Avg Attention</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{totalAlerts}</p>
                  <p className="text-sm text-muted-foreground">Total Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendance Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : sessions && sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <LogIn className="h-4 w-4" /> Login
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <LogOut className="h-4 w-4" /> Logout
                        </div>
                      </TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" /> Attention
                        </div>
                      </TableHead>
                      <TableHead>Tab Switches</TableHead>
                      <TableHead>Alerts</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const sessionAlerts = alerts?.filter(a => a.session_id === session.id) || [];
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.profiles?.full_name || "Unknown"}
                          </TableCell>
                          <TableCell>{formatDate(session.started_at)}</TableCell>
                          <TableCell>
                            <span className="text-success font-mono">
                              {formatTime(session.started_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-destructive font-mono">
                              {session.ended_at ? formatTime(session.ended_at) : "Still Active"}
                            </span>
                          </TableCell>
                          <TableCell>{formatDuration(session.total_duration_seconds)}</TableCell>
                          <TableCell>{getAttentionBadge(session.average_attention_score)}</TableCell>
                          <TableCell>
                            <Badge variant={session.tab_switches ? "destructive" : "secondary"}>
                              {session.tab_switches || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sessionAlerts.length > 0 ? "destructive" : "secondary"}>
                              {sessionAlerts.length}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No session data available</p>
            )}
          </CardContent>
        </Card>

        {/* Alert History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alert History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts && alerts.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                      alert.severity === "high" ? "text-destructive" : "text-warning"
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {alert.monitoring_sessions?.profiles?.full_name || "Unknown"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {alert.alert_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(alert.created_at), "MMM dd, yyyy hh:mm:ss a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No alerts recorded</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionReport;
