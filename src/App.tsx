import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StudentMonitor from "./pages/StudentMonitor";
import StudentProfile from "./pages/StudentProfile";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherClasses from "./pages/TeacherClasses";
import TeacherClassMonitor from "./pages/TeacherClassMonitor";
import SessionReport from "./pages/SessionReport";
import JoinClass from "./pages/JoinClass";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/student" element={
            <ProtectedRoute>
              <StudentMonitor />
            </ProtectedRoute>
          } />
          <Route path="/student/profile" element={
            <ProtectedRoute>
              <StudentProfile />
            </ProtectedRoute>
          } />
          <Route path="/teacher" element={
            <ProtectedRoute>
              <TeacherDashboard />
            </ProtectedRoute>
          } />
          <Route path="/teacher/classes" element={
            <ProtectedRoute>
              <TeacherClasses />
            </ProtectedRoute>
          } />
          <Route path="/teacher/class/:classId" element={
            <ProtectedRoute>
              <TeacherClassMonitor />
            </ProtectedRoute>
          } />
          <Route path="/teacher/class/:classId/report" element={
            <ProtectedRoute>
              <SessionReport />
            </ProtectedRoute>
          } />
          <Route path="/join/:code?" element={
            <ProtectedRoute>
              <JoinClass />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
