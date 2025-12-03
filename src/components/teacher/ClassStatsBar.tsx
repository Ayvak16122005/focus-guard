import { Card, CardContent } from "@/components/ui/card";
import { Users, Eye, AlertCircle, Moon, EyeOff } from "lucide-react";

interface ClassStatsBarProps {
  total: number;
  attentive: number;
  distracted: number;
  drowsy: number;
  notOnScreen: number;
}

const ClassStatsBar = ({
  total,
  attentive,
  distracted,
  drowsy,
  notOnScreen,
}: ClassStatsBarProps) => {
  const stats = [
    {
      label: "Total",
      value: total,
      icon: Users,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Attentive",
      value: attentive,
      icon: Eye,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Distracted",
      value: distracted,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Drowsy",
      value: drowsy,
      icon: Moon,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Not Visible",
      value: notOnScreen,
      icon: EyeOff,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  // Calculate percentages for the visual bar
  const attentivePercent = total > 0 ? (attentive / total) * 100 : 0;
  const distractedPercent = total > 0 ? (distracted / total) * 100 : 0;
  const drowsyPercent = total > 0 ? (drowsy / total) * 100 : 0;
  const notVisiblePercent = total > 0 ? (notOnScreen / total) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Stats Cards Row */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bgColor} rounded-lg p-3 text-center`}
            >
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Visual Progress Bar */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Class Attention Distribution</span>
              <span>
                {Math.round(attentivePercent)}% attentive
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              {attentivePercent > 0 && (
                <div
                  className="bg-success transition-all"
                  style={{ width: `${attentivePercent}%` }}
                  title={`Attentive: ${attentive}`}
                />
              )}
              {distractedPercent > 0 && (
                <div
                  className="bg-warning transition-all"
                  style={{ width: `${distractedPercent}%` }}
                  title={`Distracted: ${distracted}`}
                />
              )}
              {drowsyPercent > 0 && (
                <div
                  className="bg-destructive transition-all"
                  style={{ width: `${drowsyPercent}%` }}
                  title={`Drowsy: ${drowsy}`}
                />
              )}
              {notVisiblePercent > 0 && (
                <div
                  className="bg-muted-foreground/30 transition-all"
                  style={{ width: `${notVisiblePercent}%` }}
                  title={`Not Visible: ${notOnScreen}`}
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-success" /> Attentive
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-warning" /> Distracted
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-destructive" /> Drowsy
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" /> Not Visible
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassStatsBar;
