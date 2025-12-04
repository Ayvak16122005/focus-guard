import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowRight, Link as LinkIcon, Loader2 } from "lucide-react";
import WaitingRoom from "@/components/student/WaitingRoom";

const JoinClass = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState(code || "");
  const [linkInput, setLinkInput] = useState("");
  const [waitingRequest, setWaitingRequest] = useState<{
    id: string;
    className: string;
    classId: string;
  } | null>(null);

  useEffect(() => {
    if (code) {
      setJoinCode(code.toUpperCase());
    }
  }, [code]);

  // Extract code from link input
  const handleLinkInput = (value: string) => {
    setLinkInput(value);
    // Extract code from URL like /join/ABC123
    const match = value.match(/\/join\/([A-Z0-9]{6})/i);
    if (match) {
      setJoinCode(match[1].toUpperCase());
    }
  };

  // Fetch class by join code
  const fetchClassData = async (code: string) => {
    if (!code) return null;

    try {
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

  // Request to join class mutation (with approval)
  const joinRequestMutation = useMutation({
    mutationFn: async () => {
      if (!classData) throw new Error("Class not found");

      const userResult = await supabase.auth.getUser();
      if (!userResult.data.user) throw new Error("Not authenticated");

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userResult.data.user.id)
        .single();

      // Check if already enrolled
      const existing = await supabase
        .from("class_students")
        .select()
        .eq("class_id", classData.id)
        .eq("student_id", userResult.data.user.id)
        .maybeSingle();

      if (existing.data) {
        return { alreadyEnrolled: true, requestId: null };
      }

      // Check if there's already a pending request
      const { data: existingRequest } = await supabase
        .from("join_requests")
        .select()
        .eq("class_id", classData.id)
        .eq("student_id", userResult.data.user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        return {
          alreadyEnrolled: false,
          requestId: existingRequest.id,
          alreadyRequested: true,
        };
      }

      // Create join request for teacher approval
      const { data: request, error } = await supabase
        .from("join_requests")
        .insert({
          class_id: classData.id,
          student_id: userResult.data.user.id,
          student_name: profile?.full_name || "Student",
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return { alreadyEnrolled: false, requestId: request.id };
    },
    onSuccess: (result) => {
      if (result.alreadyEnrolled) {
        toast({
          title: "Already Enrolled",
          description: "You're already part of this class!",
        });
        navigate("/student");
      } else if (result.requestId) {
        toast({
          title: "Request Sent!",
          description: "Waiting for teacher approval...",
        });
        setWaitingRequest({
          id: result.requestId,
          className: classData?.name || "Class",
          classId: classData?.id || "",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Show waiting room if request is pending
  if (waitingRequest) {
    return (
      <WaitingRoom
        requestId={waitingRequest.id}
        className={waitingRequest.className}
        classId={waitingRequest.classId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join a Class</CardTitle>
          <CardDescription>
            Enter the class code or paste a join link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Link Input */}
          <div className="space-y-2">
            <Label htmlFor="linkInput" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Paste Join Link (optional)
            </Label>
            <Input
              id="linkInput"
              placeholder="https://...../join/ABC123"
              value={linkInput}
              onChange={(e) => handleLinkInput(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or enter code</span>
            </div>
          </div>

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
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up class...
            </div>
          )}

          {classData && (
            <Card className="bg-muted/50 border-primary/20">
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
            onClick={() => joinRequestMutation.mutate()}
            disabled={!classData || joinRequestMutation.isPending}
          >
            {joinRequestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                Request to Join
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
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
