import { useState } from "react";
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
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// Mock student data
const students = [
  { id: 1, name: "Alice Johnson", status: "focused", score: 95, distracted: 0 },
  { id: 2, name: "Bob Smith", status: "distracted", score: 65, distracted: 45 },
  { id: 3, name: "Carol White", status: "focused", score: 88, distracted: 0 },
  { id: 4, name: "David Brown", status: "drowsy", score: 45, distracted: 120 },
  { id: 5, name: "Eve Davis", status: "focused", score: 92, distracted: 0 },
  { id: 6, name: "Frank Miller", status: "distracted", score: 58, distracted: 67 },
  { id: 7, name: "Grace Lee", status: "focused", score: 97, distracted: 0 },
  { id: 8, name: "Henry Wilson", status: "focused", score: 85, distracted: 12 },
];

const attentionTrendData = [
  { time: "0m", avgScore: 95 },
  { time: "5m", avgScore: 92 },
  { time: "10m", avgScore: 88 },
  { time: "15m", avgScore: 85 },
  { time: "20m", avgScore: 78 },
  { time: "25m", avgScore: 75 },
  { time: "30m", avgScore: 72 },
];

const classComparisonData = [
  { class: "Math 101", avgScore: 82 },
  { class: "Physics 201", avgScore: 75 },
  { class: "Chemistry 301", avgScore: 88 },
  { class: "Biology 101", avgScore: 79 },
];

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);

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

  const focusedCount = students.filter((s) => s.status === "focused").length;
  const distractedCount = students.filter((s) => s.status === "distracted").length;
  const drowsyCount = students.filter((s) => s.status === "drowsy").length;
  const avgScore = Math.round(
    students.reduce((sum, s) => sum + s.score, 0) / students.length
  );

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
          <div className="w-24" />
        </div>

        {/* Stats Overview */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-foreground">{students.length}</p>
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
                Student Grid View
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {students.map((student) => (
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
                {students
                  .filter((s) => s.distracted >= 60)
                  .map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-lg bg-background p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {student.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Distracted for {student.distracted} seconds
                        </p>
                      </div>
                      <Badge className="bg-destructive text-destructive-foreground">
                        {student.status === "drowsy" ? "Drowsy" : "Distracted"}
                      </Badge>
                    </div>
                  ))}
                {students.filter((s) => s.distracted >= 60).length === 0 && (
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
                Attention Trend (Current Session)
              </h2>
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
              <p className="mt-4 text-sm text-muted-foreground">
                Average attention decreases after 15-20 minutes. Consider taking a
                short break or changing activity.
              </p>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  High Performers
                </h3>
                <div className="space-y-3">
                  {students
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
                    ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Needs Support
                </h3>
                <div className="space-y-3">
                  {students
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
                    ))}
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
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={classComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="class" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="avgScore" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-4 text-sm text-muted-foreground">
                Chemistry 301 shows the highest engagement. Consider reviewing
                teaching strategies from this class.
              </p>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Best Performing Class
                </h3>
                <div className="text-center">
                  <p className="mb-2 text-3xl font-bold text-success">
                    Chemistry 301
                  </p>
                  <p className="text-sm text-muted-foreground">
                    88% average attention score
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Needs Improvement
                </h3>
                <div className="text-center">
                  <p className="mb-2 text-3xl font-bold text-warning">
                    Physics 201
                  </p>
                  <p className="text-sm text-muted-foreground">
                    75% average attention score
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TeacherDashboard;
