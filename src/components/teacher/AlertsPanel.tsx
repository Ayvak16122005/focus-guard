import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Volume2 } from "lucide-react";

interface Alert {
  id: string;
  alert_type: string;
  message: string;
  severity: string;
  created_at: string;
  acknowledged: boolean;
  monitoring_sessions?: {
    profiles?: {
      full_name: string;
    };
  };
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onPlaySound?: () => void;
}

const AlertsPanel = ({ alerts, onAcknowledge, onPlaySound }: AlertsPanelProps) => {
  const getAlertTypeBadge = (alertType: string) => {
    switch (alertType) {
      case "drowsy":
        return <Badge variant="destructive">😴 Sleeping</Badge>;
      case "yawning":
        return <Badge className="bg-warning text-warning-foreground">🥱 Yawning</Badge>;
      case "not_on_screen":
        return <Badge variant="destructive">👤 Not Visible</Badge>;
      case "looking_away":
        return <Badge variant="secondary">👀 Looking Away</Badge>;
      case "prolonged_inattention":
        return <Badge variant="destructive">⏰ Extended Inattention</Badge>;
      default:
        return <Badge variant="secondary">{alertType}</Badge>;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-destructive" />
            Live Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          {onPlaySound && alerts.length > 0 && (
            <Button variant="ghost" size="icon" onClick={onPlaySound}>
              <Volume2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active alerts</p>
              <p className="text-xs">Alerts will appear here when students need attention</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`transition-all ${
                    alert.severity === "high"
                      ? "border-destructive bg-destructive/10 animate-pulse"
                      : "border-warning bg-warning/10"
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">
                            {alert.monitoring_sessions?.profiles?.full_name || "Unknown"}
                          </span>
                          {getAlertTypeBadge(alert.alert_type)}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(alert.created_at)}
                        </p>
                      </div>
                      {onAcknowledge && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => onAcknowledge(alert.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;
