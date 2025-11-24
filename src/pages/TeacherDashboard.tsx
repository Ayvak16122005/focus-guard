import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Fetch teacher's classes
  const { data: classes } = useQuery({
    queryKey: ["teacher-classes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch active monitoring sessions for teacher's classes
  const { data: activeSessions } = useQuery({
    queryKey: ["active-sessions", classes],
    queryFn: async () => {
      if (!classes || classes.length === 0) return [];
      
      const classIds = classes.map(c => c.id);
      const { data, error } = await supabase
        .from("monitoring_sessions")
        .select(`
          *,
          profiles:student_id (
            id,
            full_name
          ),
          classes (
            name
          )
        `)
        .in("class_id", classIds)
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
    enabled: !!classes && classes.length > 0,
  });

  // Fetch latest attention metrics for active sessions
  const { data: latestMetrics } = useQuery({
    queryKey: ["latest-metrics", activeSessions],
    queryFn: async () => {
      if (!activeSessions || activeSessions.length === 0) return [];
      
      const sessionIds = activeSessions.map(s => s.id);
      const { data, error } = await supabase
        .from("attention_metrics")
        .select("*")
        .in("session_id", sessionIds)
        .order("timestamp", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeSessions && activeSessions.length > 0,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Fetch active alerts
  const { data: activeAlerts } = useQuery({
    queryKey: ["active-alerts", activeSessions],
    queryFn: async () => {
      if (!activeSessions || activeSessions.length === 0) return [];
      
      const sessionIds = activeSessions.map(s => s.id);
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          *,
          profiles:student_id (
            full_name
          )
        `)
        .in("session_id", sessionIds)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeSessions && activeSessions.length > 0,
    refetchInterval: 5000,
  });

  // Process data for display
  const studentsData = useMemo(() => {
    if (!activeSessions || !latestMetrics) return [];

    return activeSessions.map(session => {
      const sessionMetrics = latestMetrics.filter(m => m.session_id === session.id);
      const latestMetric = sessionMetrics[0];
      
      // Calculate average attention score for this session
      const avgScore = sessionMetrics.length > 0
        ? Math.round(sessionMetrics.reduce((sum, m) => sum + m.attention_score, 0) / sessionMetrics.length)
        : 0;

      return {
        id: session.student_id,
        name: session.profiles?.full_name || "Unknown Student",
        status: latestMetric?.status || "focused",
        score: avgScore,
        distracted: session.total_distraction_time_seconds || 0,
        className: session.classes?.name || "Unknown Class",
      };
    });
  }, [activeSessions, latestMetrics]);

  // Calculate class comparison data
  const classComparisonData = useMemo(() => {
    if (!classes || !activeSessions || !latestMetrics) return [];

    return classes.map(cls => {
      const classSessions = activeSessions.filter(s => s.class_id === cls.id);
      const classMetrics = latestMetrics.filter(m => 
        classSessions.some(s => s.id === m.session_id)
      );

      const avgScore = classMetrics.length > 0
        ? Math.round(classMetrics.reduce((sum, m) => sum + m.attention_score, 0) / classMetrics.length)
        : 0;

      return {
        class: cls.name,
        avgScore,
      };
    }).filter(c => c.avgScore > 0);
  }, [classes, activeSessions, latestMetrics]);

  // Calculate attention trend data (last 30 minutes, grouped by 5-minute intervals)
  const attentionTrendData = useMemo(() => {
    if (!latestMetrics || latestMetrics.length === 0) return [];

    const now = new Date();
    const intervals = [];
    
    for (let i = 6; i >= 0; i--) {
      const intervalEnd = new Date(now.getTime() - (i * 5 * 60 * 1000));
      const intervalStart = new Date(intervalEnd.getTime() - (5 * 60 * 1000));
      
      const intervalMetrics = latestMetrics.filter(m => {
        const metricTime = new Date(m.timestamp!);
        return metricTime >= intervalStart && metricTime < intervalEnd;
      });

      if (intervalMetrics.length > 0) {
        const avgScore = Math.round(
          intervalMetrics.reduce((sum, m) => sum + m.attention_score, 0) / intervalMetrics.length
        );
        
        intervals.push({
          time: `${(6 - i) * 5}m`,
          avgScore,
        });
      }
    }

    return intervals;
  }, [latestMetrics]);

  const handleManageClasses = () => {
    navigate("/teacher/classes");
  };

  const getStatusBadge = (status: string, distracted: number) => {
    if (distracted >= 60) {
      return (
        <Badge className="bg-destructive text-destructive-foreground">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Alert Sent
        </Badge>
      );
    }

    switch (status) {
      case "focused":
        return (
          <Badge className="bg-success text-success-foreground">Focused</Badge>
        );
      case "distracted":
        return (
          <Badge className="bg-warning text-warning-foreground">
            Distracted
          </Badge>
        );
      case "drowsy":
        return (
          <Badge className="bg-destructive text-destructive-foreground">
            Drowsy
          </Badge>
        );
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const focusedCount = studentsData.filter((s) => s.status === "focused").length;
  const distractedCount = studentsData.filter((s) => s.status === "distracted").length;
  const drowsyCount = studentsData.filter((s) => s.status === "drowsy").length;
  const avgScore = studentsData.length > 0
    ? Math.round(studentsData.reduce((sum, s) => sum + s.score, 0) / studentsData.length)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
          <Button onClick={handleManageClasses}>
            Manage Classes
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-foreground">{studentsData.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Attention</p>
                <p className="text-3xl font-bold text-foreground">{avgScore}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Focused</p>
                <p className="text-3xl font-bold text-success">{focusedCount}</p>
              </div>
              <Eye className="h-8 w-8 text-success" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Need Attention</p>
                <p className="text-3xl font-bold text-destructive">
                  {distractedCount + drowsyCount}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live">Live Monitoring</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="comparison">Class Comparison</TabsTrigger>
          </TabsList>

          {/* Live Monitoring Tab */}
          <TabsContent value="live" className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Active Students
              </h2>
              {studentsData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No students are currently being monitored
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {studentsData.map((student) => (
                  <Card
                    key={student.id}
                    className={`cursor-pointer p-4 transition-all hover:shadow-medium ${
                      selectedStudent === student.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedStudent(student.id)}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {student.name}
                      </span>
                      {getStatusBadge(student.status, student.distracted)}
                    </div>
                    <div className="mb-2">
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Attention</span>
                        <span className="font-medium text-foreground">
                          {student.score}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${
                            student.score >= 80
                              ? "bg-success"
                              : student.score >= 60
                              ? "bg-warning"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${student.score}%` }}
                        />
                      </div>
                    </div>
                    {student.distracted > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Distracted: {student.distracted}s
                      </p>
                    )}
                  </Card>
                  ))}
                </div>
              )}
            </Card>

            {/* Alerts Panel */}
            <Card className="border-destructive/50 bg-destructive/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="text-xl font-semibold text-foreground">
                  Active Alerts
                </h2>
              </div>
              <div className="space-y-3">
                {activeAlerts && activeAlerts.length > 0 ? (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between rounded-lg bg-background p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {alert.profiles?.full_name || "Unknown Student"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {alert.message}
                        </p>
                      </div>
                      <Badge className={
                        alert.severity === "high" 
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-warning text-warning-foreground"
                      }>
                        {alert.alert_type}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    No active alerts
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Attention Trend (Last 30 Minutes)
              </h2>
              {attentionTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attentionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="avgScore"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  No attention data available yet
                </p>
              )}
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  High Performers
                </h3>
                <div className="space-y-3">
                  {studentsData.length > 0 ? (
                    studentsData
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 3)
                      .map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-foreground">
                            {student.name}
                          </span>
                          <Badge className="bg-success text-success-foreground">
                            {student.score}%
                          </Badge>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      No data available
                    </p>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Needs Support
                </h3>
                <div className="space-y-3">
                  {studentsData.length > 0 ? (
                    studentsData
                      .sort((a, b) => a.score - b.score)
                      .slice(0, 3)
                      .map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-foreground">
                            {student.name}
                          </span>
                          <Badge className="bg-destructive text-destructive-foreground">
                            {student.score}%
                          </Badge>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      No data available
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Class Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Engagement Across Classes
              </h2>
              {classComparisonData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="class" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="grid gap-6 md:grid-cols-2 mt-6">
                    <Card className="p-6">
                      <h3 className="mb-4 text-lg font-semibold text-foreground">
                        Best Performing Class
                      </h3>
                      <div className="text-center">
                        {classComparisonData.length > 0 && (
                          <>
                            <p className="mb-2 text-3xl font-bold text-success">
                              {classComparisonData.sort((a, b) => b.avgScore - a.avgScore)[0].class}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {classComparisonData.sort((a, b) => b.avgScore - a.avgScore)[0].avgScore}% average attention score
                            </p>
                          </>
                        )}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="mb-4 text-lg font-semibold text-foreground">
                        Needs Improvement
                      </h3>
                      <div className="text-center">
                        {classComparisonData.length > 0 && (
                          <>
                            <p className="mb-2 text-3xl font-bold text-warning">
                              {classComparisonData.sort((a, b) => a.avgScore - b.avgScore)[0].class}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {classComparisonData.sort((a, b) => a.avgScore - b.avgScore)[0].avgScore}% average attention score
                            </p>
                          </>
                        )}
                      </div>
                    </Card>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  No class comparison data available yet
                </p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TeacherDashboard;
