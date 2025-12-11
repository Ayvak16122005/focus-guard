import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, User, Mail, Save, Loader2 } from "lucide-react";

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullName, setFullName] = useState("");

  // Fetch profile data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setFullName(data.full_name);
      return { ...data, email: user.email };
    },
  });

  // Fetch enrolled classes
  const { data: enrolledClasses } = useQuery({
    queryKey: ["student-enrolled-classes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("class_students")
        .select(`
          class_id,
          joined_at,
          classes(id, name, is_active)
        `)
        .eq("student_id", user.id);

      return data || [];
    },
  });

  // Fetch session statistics
  const { data: sessionStats } = useQuery({
    queryKey: ["student-session-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("monitoring_sessions")
        .select("*")
        .eq("student_id", user.id);

      if (!data) return null;

      const totalSessions = data.length;
      const totalDuration = data.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
      const avgAttention = data.length > 0 
        ? Math.round(data.reduce((sum, s) => sum + (s.average_attention_score || 0), 0) / data.length)
        : 0;

      return { totalSessions, totalDuration, avgAttention };
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name?: string; avatar_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      toast({ title: "Profile updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error updating profile", variant: "destructive" });
    },
  });

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: publicUrl });
      
      toast({ title: "Photo uploaded successfully!" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error uploading photo", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6 text-center">
              <div className="relative inline-block">
                <Avatar className="h-24 w-24 mx-auto border-4 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{profile?.full_name}</h2>
              <p className="text-muted-foreground text-sm">{profile?.email}</p>
              <Badge className="mt-2" variant="secondary">Student</Badge>
            </CardContent>
          </Card>

          {/* Edit Profile Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <Button
                onClick={() => updateProfileMutation.mutate({ full_name: fullName })}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{sessionStats?.totalSessions || 0}</p>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">
                {formatDuration(sessionStats?.totalDuration || 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{sessionStats?.avgAttention || 0}%</p>
              <p className="text-sm text-muted-foreground">Avg. Attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Enrolled Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {enrolledClasses && enrolledClasses.length > 0 ? (
              <div className="space-y-2">
                {enrolledClasses.map((enrollment: any) => (
                  <div
                    key={enrollment.class_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{enrollment.classes?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Joined: {new Date(enrollment.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={enrollment.classes?.is_active ? "default" : "secondary"}>
                      {enrollment.classes?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No classes enrolled yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentProfile;
