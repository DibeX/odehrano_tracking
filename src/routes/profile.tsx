import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Upload, X, Check } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

// Helper function to create cropped image
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas is empty"));
      }
    }, "image/jpeg");
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

function ProfilePage() {
  const { user, supabaseUser } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const [nickname, setNickname] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [imageToUpload, setImageToUpload] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Track original values for change detection
  const [originalNickname, setOriginalNickname] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setDescription(user.description || "");
      setAvatarUrl(user.avatar_url || null);
      setOriginalNickname(user.nickname);
      setOriginalDescription(user.description || "");
      setOriginalAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  // Check if there are any changes
  const hasChanges =
    nickname !== originalNickname ||
    description !== originalDescription ||
    avatarUrl !== originalAvatarUrl ||
    avatarBlob !== null;

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageToUpload(event.target?.result as string);
        setShowCropper(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  }

  function cancelCrop() {
    setImageToUpload(null);
    setShowCropper(false);
    setCroppedAreaPixels(null);
  }

  async function handleCropConfirm() {
    if (!imageToUpload || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(imageToUpload, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(croppedBlob);

      setAvatarBlob(croppedBlob);
      setAvatarPreview(previewUrl);
      setShowCropper(false);
      setImageToUpload(null);
      setCroppedAreaPixels(null);
    } catch (error: any) {
      toast({
        title: _(t`Error cropping image`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function removeAvatar() {
    setAvatarUrl(null);
    setAvatarPreview(null);
    setAvatarBlob(null);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!user) throw new Error("User not found");

      let finalAvatarUrl = avatarUrl;

      // Upload new avatar if there's a blob to upload
      if (avatarBlob) {
        const fileName = `${Date.now()}.jpg`;
        // Use supabaseUser.id (auth_user_id) for storage path to match RLS policy
        const filePath = `${supabaseUser?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarBlob, {
            cacheControl: "31536000",
          });

        if (uploadError) {
          throw new Error(`Failed to upload avatar: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        finalAvatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from("users")
        .update({
          nickname,
          description,
          avatar_url: finalAvatarUrl,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update local state to match saved values
      setAvatarUrl(finalAvatarUrl);
      setAvatarBlob(null);
      setAvatarPreview(null);
      setOriginalNickname(nickname);
      setOriginalDescription(description);
      setOriginalAvatarUrl(finalAvatarUrl);

      toast({
        title: _(t`Profile updated`),
        description: _(t`Your profile has been updated successfully`),
      });
    } catch (error: any) {
      toast({
        title: _(t`Error updating profile`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: _(t`Passwords do not match`),
        description: _(t`Please make sure your passwords match`),
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: _(t`Password too short`),
        description: _(t`Password must be at least 8 characters long`),
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: _(t`Password changed`),
        description: _(t`Your password has been changed successfully`),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: _(t`Error changing password`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Trans>My Profile</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>Manage your account settings</Trans>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Profile Information</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Update your personal information</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Upload Section */}
              <div className="space-y-2">
                <Label>
                  <Trans>Profile Avatar</Trans>
                </Label>
                {showCropper && imageToUpload ? (
                  <div className="space-y-4">
                    <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
                      <Cropper
                        image={imageToUpload}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        <Trans>Zoom</Trans>
                      </Label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleCropConfirm}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        <Trans>Confirm Crop</Trans>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelCrop}
                      >
                        <X className="w-4 h-4 mr-2" />
                        <Trans>Cancel</Trans>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {avatarPreview || avatarUrl ? (
                      <div className="relative">
                        <img
                          src={avatarPreview || avatarUrl || ""}
                          alt={nickname}
                          className="w-24 h-24 rounded-full object-cover border-2 border-muted"
                        />
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-2xl text-muted-foreground">
                          {nickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        <Trans>Upload Avatar</Trans>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  <Trans>Upload an image and crop it to create your avatar</Trans>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Trans>Email</Trans>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  <Trans>Email cannot be changed</Trans>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">
                  <Trans>Nickname</Trans>
                </Label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  <Trans>Description</Trans>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={_(t`Tell us about yourself...`)}
                  disabled={saving}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  <Trans>Role</Trans>
                </Label>
                <Input value={user?.role || ""} disabled />
                <p className="text-xs text-muted-foreground">
                  <Trans>Contact an admin to change your role</Trans>
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !hasChanges}>
                  {saving ? (
                    <Trans>Saving...</Trans>
                  ) : (
                    <Trans>Save Changes</Trans>
                  )}
                </Button>
                {hasChanges && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNickname(originalNickname);
                      setDescription(originalDescription);
                      setAvatarUrl(originalAvatarUrl);
                      setAvatarPreview(null);
                      setAvatarBlob(null);
                    }}
                    disabled={saving}
                  >
                    <Trans>Reset</Trans>
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Change Password</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Update your password</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  <Trans>New Password</Trans>
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={changingPassword}
                  minLength={8}
                  placeholder={_(t`Enter new password`)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  <Trans>Confirm New Password</Trans>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={changingPassword}
                  minLength={8}
                  placeholder={_(t`Confirm new password`)}
                />
              </div>

              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? (
                  <Trans>Changing...</Trans>
                ) : (
                  <Trans>Change Password</Trans>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
