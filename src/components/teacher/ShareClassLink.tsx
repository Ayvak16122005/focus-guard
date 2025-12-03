import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Link,
  Share2,
  QrCode,
  Mail,
  MessageCircle,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShareClassLinkProps {
  joinCode: string;
  className: string;
  studentCount: number;
}

const ShareClassLink = ({ joinCode, className, studentCount }: ShareClassLinkProps) => {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const joinLink = `${window.location.origin}/join/${joinCode}`;

  const copyToClipboard = async (text: string, type: "link" | "code") => {
    await navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
    toast({
      title: "Copied!",
      description: `${type === "link" ? "Join link" : "Join code"} copied to clipboard`,
    });
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Join my class: ${className}`);
    const body = encodeURIComponent(
      `Hello!\n\nYou're invited to join my class "${className}" on FocusWatch.\n\nClick the link below to join:\n${joinLink}\n\nOr use the code: ${joinCode}\n\nSee you in class!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `📚 Join my class "${className}" on FocusWatch!\n\n🔗 Link: ${joinLink}\n\n🔑 Code: ${joinCode}`
    );
    window.open(`https://wa.me/?text=${text}`);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${className}`,
          text: `Join my class "${className}" using code: ${joinCode}`,
          url: joinLink,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5 text-primary" />
            Invite Students
          </CardTitle>
          <Badge variant="secondary">{studentCount} joined</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Join Code Display */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Class Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border-2 border-dashed border-primary/30 rounded-lg p-3 text-center">
              <span className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                {joinCode}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(joinCode, "code")}
            >
              {copiedCode ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Join Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Direct Link
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={joinLink}
              readOnly
              className="text-sm font-mono bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(joinLink, "link")}
            >
              {copiedLink ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => copyToClipboard(joinLink, "link")}
          >
            <Link className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={shareViaEmail}
          >
            <Mail className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={shareViaWhatsApp}
            className="bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
          </Button>

          {navigator.share && (
            <Button variant="outline" size="sm" onClick={shareNative}>
              <Share2 className="h-4 w-4" />
            </Button>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <QrCode className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>QR Code</DialogTitle>
                <DialogDescription>
                  Students can scan this QR code to join the class
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {/* Simple QR Code using external service */}
                <div className="p-4 bg-white rounded-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinLink)}`}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-mono text-2xl font-bold tracking-widest">
                    {joinCode}
                  </p>
                  <p className="text-sm text-muted-foreground">{className}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium">How students join:</p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1">
            <li>Share the link or code with students</li>
            <li>Students sign in to FocusWatch</li>
            <li>They enter the code or click the link</li>
            <li>AI monitoring starts when they enable camera</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShareClassLink;
