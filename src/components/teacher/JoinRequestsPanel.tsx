import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JoinRequest {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
  created_at: string;
}

interface JoinRequestsPanelProps {
  requests: JoinRequest[];
  onApprove: (requestId: string, studentId: string) => void;
  onReject: (requestId: string) => void;
  isLoading?: boolean;
}

const JoinRequestsPanel = ({ requests, onApprove, onReject, isLoading }: JoinRequestsPanelProps) => {
  const pendingRequests = requests.filter((r) => r.status === "pending");

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <UserPlus className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No pending join requests</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Students will appear here when they request to join
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Join Requests
          <Badge variant="secondary">{pendingRequests.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {request.student_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium">{request.student_name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(request.id)}
                disabled={isLoading}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(request.id, request.student_id)}
                disabled={isLoading}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default JoinRequestsPanel;
