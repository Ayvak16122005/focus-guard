import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowRight } from "lucide-react";

const JoinClass = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState(code || "");

  useEffect(() => {
    if (code) {
      setJoinCode(code.toUpperCase());
    }
  }, [code]);

  // Fetch class by join code
  const fetchClassData = async (code: string) => {
    if (!code) return null;

    try {
      // @ts-ignore - Supabase type inference issue with complex queries
      const classQuery: any = supabase
        .from("classes")
        .select("*")
        .eq("join_code", code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      
      const { data: classData, error: classError } = await classQuery;

      if (classError) throw classError;
      if (!classData) return null;

      const { data: teacherData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", classData.teacher_id)
        .single();

      const { count } = await supabase
        .from("class_students")
        .select("*", { count: "exact", head: true })
        .eq("class_id", classData.id);

      return {
        ...classData,
        profiles: teacherData,
        class_students: [{ count: count || 0 }],
      };
    } catch (error) {
      console.error("Error fetching class:", error);
      return null;
    }
  };

  const { data: classData, isLoading } = useQuery({
    queryKey: ["class-by-code", joinCode],
    queryFn: () => fetchClassData(joinCode),
    enabled: joinCode.length === 6,
  });

  // Join class mutation
  const joinClassMutation = useMutation({
    mutationFn: async () => {
      if (!classData) throw new Error("Class not found");

      const userResult = await supabase.auth.getUser();
      if (!userResult.data.user) throw new Error("Not authenticated");

      // Check if already enrolled
      const existing = await supabase
        .from("class_students")
        .select()
        .eq("class_id", classData.id)
        .eq("student_id", userResult.data.user.id)
        .maybeSingle();

      if (existing.data) {
        return { alreadyEnrolled: true };
      }

      const insertResult = await supabase
        .from("class_students")
        .insert({
          class_id: classData.id,
          student_id: userResult.data.user.id,
        });

      if (insertResult.error) throw insertResult.error;
      return { alreadyEnrolled: false };
    },
    onSuccess: (result) => {
      if (result.alreadyEnrolled) {
        toast({
          title: "Already Enrolled",
          description: "You're already part of this class!",
        });
      } else {
        toast({
          title: "✓ Joined Successfully",
          description: "You've been enrolled in the class!",
        });
      }
      navigate("/student");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join a Class</CardTitle>
          <CardDescription>
            Enter the class code provided by your teacher
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="joinCode">Class Code</Label>
            <Input
              id="joinCode"
              placeholder="XXXXXX"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-2xl font-mono font-bold tracking-widest"
            />
          </div>

          {isLoading && joinCode.length === 6 && (
            <div className="text-center text-sm text-muted-foreground">
              Looking up class...
            </div>
          )}

          {classData && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6 space-y-2">
                <div className="text-sm text-muted-foreground">Class Found</div>
                <div className="font-semibold text-lg">{classData.name}</div>
                {classData.description && (
                  <div className="text-sm text-muted-foreground">
                    {classData.description}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Teacher: {classData.profiles?.full_name || "Unknown"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {classData.class_students?.[0]?.count || 0} students enrolled
                </div>
              </CardContent>
            </Card>
          )}

          {joinCode.length === 6 && !isLoading && !classData && (
            <div className="text-center text-sm text-destructive">
              Class not found. Please check the code.
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => joinClassMutation.mutate()}
            disabled={!classData || joinClassMutation.isPending}
          >
            {joinClassMutation.isPending ? "Joining..." : "Join Class"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinClass;
