import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BroadcastMessage {
  id: string;
  message: string;
  created_at: string;
}

interface BroadcastMessagesProps {
  classId: string;
}

const BroadcastMessages = ({ classId }: BroadcastMessagesProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    alertSoundRef.current = new Audio("/alert-sound.mp3");
    alertSoundRef.current.volume = 0.6;
  }, []);

  // Fetch existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("broadcast_messages")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setMessages(data);
      }
    };

    fetchMessages();
  }, [classId]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`broadcast-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "broadcast_messages",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const newMsg = payload.new as BroadcastMessage;
          setMessages((prev) => [newMsg, ...prev].slice(0, 10));
          setNewMessageCount((prev) => prev + 1);

          // Play alert sound
          alertSoundRef.current?.play().catch(console.error);

          // Show toast notification
          toast({
            title: "📢 Teacher Announcement",
            description: newMsg.message,
          });

          // Clear new message indicator after 5 seconds
          setTimeout(() => setNewMessageCount(0), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, toast]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Teacher Messages
          {newMessageCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              {newMessageCount} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-40 overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg text-sm ${
              index === 0 && newMessageCount > 0
                ? "bg-primary/10 border border-primary/20"
                : "bg-muted/50"
            }`}
          >
            <p className="font-medium">{msg.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BroadcastMessages;
