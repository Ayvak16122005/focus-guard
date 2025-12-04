import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface WaitingRoomProps {
  requestId: string;
  className: string;
  classId: string;
}

const WaitingRoom = ({ requestId, className, classId }: WaitingRoomProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    // Subscribe to changes on this join request
    const channel = supabase
      .channel(`join-request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "join_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          setStatus(newStatus);

          if (newStatus === "approved") {
            toast({
              title: "✓ Request Approved!",
              description: "You can now join the class.",
            });
            // Navigate to student monitor with the class
            setTimeout(() => {
              navigate(`/student?classId=${classId}`);
            }, 1500);
          } else if (newStatus === "rejected") {
            toast({
              title: "Request Rejected",
              description: "Your request to join was not approved.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, classId, navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {status === "pending" && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
            {status === "approved" && <CheckCircle className="h-8 w-8 text-success" />}
            {status === "rejected" && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
          <CardTitle>
            {status === "pending" && "Waiting for Approval"}
            {status === "approved" && "Request Approved!"}
            {status === "rejected" && "Request Rejected"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              {status === "pending" && `Waiting for your teacher to approve your request to join`}
              {status === "approved" && "You're being redirected to the class..."}
              {status === "rejected" && "Your teacher did not approve your join request."}
            </p>
            <Badge variant="outline" className="text-lg px-4 py-1">
              {className}
            </Badge>
          </div>

          {status === "pending" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Your teacher will be notified of your request</span>
            </div>
          )}

          {status === "approved" && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Redirecting...</span>
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitingRoom;
