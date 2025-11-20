import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, BarChart3, Shield, Bell, Users, TrendingUp, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleNavigation = (path: string) => {
    if (!user) {
      navigate("/auth");
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-primary py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-white">
            {user && (
              <div className="absolute top-4 right-4 flex gap-2">
                {profile?.role === "teacher" && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/teacher/classes")}
                    className="border-white bg-transparent text-white hover:bg-white/10"
                  >
                    My Classes
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={signOut}
                  className="border-white bg-transparent text-white hover:bg-white/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            )}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">AI-Powered Attention Monitoring</span>
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
              FocusWatch
            </h1>
            {user && profile && (
              <p className="mb-4 text-lg text-white/90">
                Welcome back, {profile.full_name}!
              </p>
            )}
            <p className="mb-8 text-xl text-white/90 md:text-2xl">
              Real-time student engagement monitoring for online classes
            </p>
            <p className="mx-auto mb-12 max-w-2xl text-lg text-white/80">
              Bridge the gap between online and offline learning with AI-powered attention detection,
              drowsiness monitoring, and comprehensive analytics.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => handleNavigation("/student")}
                className="bg-white text-primary hover:bg-white/90"
              >
                <Users className="mr-2 h-5 w-5" />
                {user ? "Start Monitoring" : "Join as Student"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNavigation("/teacher")}
                className="border-white bg-transparent text-white hover:bg-white/10"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                Teacher Dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-foreground">
              Comprehensive Monitoring Features
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to ensure student engagement and attention
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary">
                <Eye className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Face & Drowsiness Detection
              </h3>
              <p className="text-muted-foreground">
                Real-time facial recognition and drowsiness detection using advanced computer vision
                to ensure students stay alert and focused.
              </p>
            </Card>

            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-warning">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Smart Alerts System
              </h3>
              <p className="text-muted-foreground">
                Automatic notifications to teachers and students when distraction exceeds 60 seconds,
                enabling immediate intervention.
              </p>
            </Card>

            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-success">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Anti-Proxy Detection
              </h3>
              <p className="text-muted-foreground">
                Prevent proxy attendance and tab switching with continuous monitoring and
                identity verification.
              </p>
            </Card>

            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Detailed Analytics
              </h3>
              <p className="text-muted-foreground">
                Comprehensive engagement reports showing attention patterns across classes and
                individual students.
              </p>
            </Card>

            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-success">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Performance Tracking
              </h3>
              <p className="text-muted-foreground">
                Track student engagement over time to identify patterns and students needing
                additional support.
              </p>
            </Card>

            <Card className="p-6 shadow-medium transition-all hover:shadow-strong">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-warning">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Class-wide Insights
              </h3>
              <p className="text-muted-foreground">
                Compare engagement across different classes to optimize teaching strategies and
                content delivery.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">95%</div>
              <div className="text-lg text-foreground">Detection Accuracy</div>
              <div className="text-sm text-muted-foreground">
                Reliable face and attention detection
              </div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-success">60s</div>
              <div className="text-lg text-foreground">Alert Threshold</div>
              <div className="text-sm text-muted-foreground">
                Notifications after sustained distraction
              </div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-warning">Real-time</div>
              <div className="text-lg text-foreground">Live Monitoring</div>
              <div className="text-sm text-muted-foreground">
                Instant feedback and analytics
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-bold text-foreground">
            Ready to Transform Online Learning?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Start monitoring student engagement and ensure every student stays focused during online classes.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/student")}
              className="bg-gradient-primary text-white"
            >
              Get Started as Student
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/teacher")}
            >
              Access Teacher Dashboard
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
