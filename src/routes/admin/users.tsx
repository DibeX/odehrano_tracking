import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireRole } from "@/lib/auth-helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { User, UserInvitation, UserRole } from "@/types";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  beforeLoad: async () => {
    await requireRole("admin");
  },
});

function UsersPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("player");
  const [inviting, setInviting] = useState(false);
  const [resendingToken, setResendingToken] = useState<string | null>(null);
  const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Placeholder user state
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [placeholderNickname, setPlaceholderNickname] = useState("");
  const [placeholderDescription, setPlaceholderDescription] = useState("");
  const [placeholderAvatarUrl, setPlaceholderAvatarUrl] = useState("");
  const [creatingPlaceholder, setCreatingPlaceholder] = useState(false);

  // Edit placeholder user state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Activate placeholder user state
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [userToActivate, setUserToActivate] = useState<User | null>(null);
  const [activateEmail, setActivateEmail] = useState("");
  const [sendingActivation, setSendingActivation] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResult, invitationsResult] = await Promise.all([
        supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_invitations")
          .select("*")
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (invitationsResult.error) throw invitationsResult.error;

      const users = usersResult.data || [];
      const pendingInvitations = invitationsResult.data || [];

      // Check for invitations that have been used but not marked as such
      // This happens when a user registers with the invite link but the used_at wasn't updated
      const userEmails = new Set(users.map((u) => u.email?.toLowerCase()).filter(Boolean));
      const usedInvitationIds: string[] = [];

      for (const invitation of pendingInvitations) {
        const inviteEmail = invitation.email.toLowerCase();
        const isUsed = userEmails.has(inviteEmail) ||
          (invitation.placeholder_user_id &&
            users.some((u) => u.id === invitation.placeholder_user_id && !u.is_placeholder));

        if (isUsed) {
          usedInvitationIds.push(invitation.id);
        }
      }

      // Mark used invitations as completed
      if (usedInvitationIds.length > 0) {
        await supabase
          .from("user_invitations")
          .update({ used_at: new Date().toISOString() })
          .in("id", usedInvitationIds);
      }

      // Filter out the used invitations from the display
      const activeInvitations = pendingInvitations.filter(
        (inv) => !usedInvitationIds.includes(inv.id)
      );

      setUsers(users);
      setInvitations(activeInvitations);
    } catch (error: any) {
      toast({
        title: _(t`Error loading data`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvitation() {
    if (!inviteEmail) {
      toast({
        title: _(t`Email required`),
        description: _(t`Please enter an email address`),
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Call the edge function to send invitation email
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail,
          role: inviteRole,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: _(t`Invitation sent`),
        description: _(t`Invitation email has been sent to ${inviteEmail}`),
      });

      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("player");
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error creating invitation`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: UserRole) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: _(t`Role updated`),
        description: _(t`User role has been updated successfully`),
      });

      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error updating role`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function handleResendInvitation(token: string) {
    setResendingToken(token);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          resend: true,
          token,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: _(t`Invitation resent`),
        description: _(t`Invitation email has been resent successfully`),
      });

      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error resending invitation`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResendingToken(null);
    }
  }

  async function handleToggleUserActive(user: User) {
    setDeactivatingUserId(user.id);
    try {
      const newStatus = !user.is_active;
      const { error } = await supabase
        .from("users")
        .update({ is_active: newStatus })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: newStatus ? _(t`User activated`) : _(t`User deactivated`),
        description: newStatus
          ? _(t`User has been activated successfully`)
          : _(t`User has been deactivated successfully`),
      });

      setConfirmDialogOpen(false);
      setUserToToggle(null);
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error updating user status`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeactivatingUserId(null);
    }
  }

  async function handleDeleteUser(user: User) {
    setDeletingUserId(user.id);
    try {
      // Call the edge function to delete user (requires service role key)
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: {
          userId: user.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: _(t`User deleted`),
        description: _(t`User and all their data have been permanently deleted`),
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteConfirmText("");
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error deleting user`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleCreatePlaceholderUser() {
    if (!placeholderNickname.trim()) {
      toast({
        title: _(t`Nickname required`),
        description: _(t`Please enter a nickname for the placeholder user`),
        variant: "destructive",
      });
      return;
    }

    setCreatingPlaceholder(true);
    try {
      const { error } = await supabase.from("users").insert({
        nickname: placeholderNickname.trim(),
        description: placeholderDescription.trim() || null,
        avatar_url: placeholderAvatarUrl.trim() || null,
        is_placeholder: true,
        role: "player",
      });

      if (error) throw error;

      toast({
        title: _(t`Placeholder user created`),
        description: _(t`The placeholder user has been created successfully`),
      });

      setPlaceholderDialogOpen(false);
      setPlaceholderNickname("");
      setPlaceholderDescription("");
      setPlaceholderAvatarUrl("");
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error creating placeholder user`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingPlaceholder(false);
    }
  }

  async function handleEditPlaceholderUser() {
    if (!userToEdit || !editNickname.trim()) {
      toast({
        title: _(t`Nickname required`),
        description: _(t`Please enter a nickname`),
        variant: "destructive",
      });
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({
          nickname: editNickname.trim(),
          description: editDescription.trim() || null,
          avatar_url: editAvatarUrl.trim() || null,
        })
        .eq("id", userToEdit.id);

      if (error) throw error;

      toast({
        title: _(t`User updated`),
        description: _(t`The user has been updated successfully`),
      });

      setEditDialogOpen(false);
      setUserToEdit(null);
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error updating user`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleActivatePlaceholderUser() {
    if (!userToActivate || !activateEmail.trim()) {
      toast({
        title: _(t`Email required`),
        description: _(t`Please enter an email address`),
        variant: "destructive",
      });
      return;
    }

    setSendingActivation(true);
    try {
      // Create an invitation for this placeholder user
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: activateEmail.trim(),
          role: userToActivate.role,
          placeholderUserId: userToActivate.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: _(t`Activation email sent`),
        description: _(t`An invitation email has been sent to ${activateEmail.trim()}`),
      });

      setActivateDialogOpen(false);
      setUserToActivate(null);
      setActivateEmail("");
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error sending activation`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingActivation(false);
    }
  }

  function openEditDialog(user: User) {
    setUserToEdit(user);
    setEditNickname(user.nickname);
    setEditDescription(user.description || "");
    setEditAvatarUrl(user.avatar_url || "");
    setEditDialogOpen(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>User Management</Trans>
            </h1>
            <p className="text-muted-foreground">
              <Trans>Manage users and send invitations</Trans>
            </p>
          </div>

          <div className="flex gap-2">
            <Dialog open={placeholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Trans>Add Placeholder User</Trans>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    <Trans>Create Placeholder User</Trans>
                  </DialogTitle>
                  <DialogDescription>
                    <Trans>
                      Create a user without an email account. They can be assigned to game sessions and activated later.
                    </Trans>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="placeholder-nickname">
                      <Trans>Nickname</Trans>
                    </Label>
                    <Input
                      id="placeholder-nickname"
                      placeholder={_(t`Enter nickname`)}
                      value={placeholderNickname}
                      onChange={(e) => setPlaceholderNickname(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="placeholder-description">
                      <Trans>Bio (optional)</Trans>
                    </Label>
                    <Input
                      id="placeholder-description"
                      placeholder={_(t`Short description`)}
                      value={placeholderDescription}
                      onChange={(e) => setPlaceholderDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="placeholder-avatar">
                      <Trans>Avatar URL (optional)</Trans>
                    </Label>
                    <Input
                      id="placeholder-avatar"
                      type="url"
                      placeholder={_(t`https://example.com/avatar.jpg`)}
                      value={placeholderAvatarUrl}
                      onChange={(e) => setPlaceholderAvatarUrl(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPlaceholderDialogOpen(false)}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button onClick={handleCreatePlaceholderUser} disabled={creatingPlaceholder}>
                    {creatingPlaceholder ? (
                      <Trans>Creating...</Trans>
                    ) : (
                      <Trans>Create User</Trans>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Trans>Invite User</Trans>
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Invite New User</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Send an invitation link to a new user. The link will expire
                    in 14 days.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Trans>Email</Trans>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={_(t`user@example.com`)}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">
                    <Trans>Role</Trans>
                  </Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">
                        <Trans>Player</Trans>
                      </SelectItem>
                      <SelectItem value="moderator">
                        <Trans>Moderator</Trans>
                      </SelectItem>
                      <SelectItem value="admin">
                        <Trans>Admin</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleCreateInvitation} disabled={inviting}>
                  {inviting ? (
                    <Trans>Creating...</Trans>
                  ) : (
                    <Trans>Create Invitation</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>

          {/* Edit placeholder user dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setUserToEdit(null);
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Edit User</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Update the user's profile information.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nickname">
                    <Trans>Nickname</Trans>
                  </Label>
                  <Input
                    id="edit-nickname"
                    placeholder={_(t`Enter nickname`)}
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">
                    <Trans>Bio</Trans>
                  </Label>
                  <Input
                    id="edit-description"
                    placeholder={_(t`Short description`)}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-avatar">
                    <Trans>Avatar URL</Trans>
                  </Label>
                  <Input
                    id="edit-avatar"
                    type="url"
                    placeholder={_(t`https://example.com/avatar.jpg`)}
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setUserToEdit(null);
                  }}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleEditPlaceholderUser} disabled={savingEdit}>
                  {savingEdit ? (
                    <Trans>Saving...</Trans>
                  ) : (
                    <Trans>Save Changes</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Activate placeholder user dialog */}
          <Dialog open={activateDialogOpen} onOpenChange={(open) => {
            setActivateDialogOpen(open);
            if (!open) {
              setUserToActivate(null);
              setActivateEmail("");
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Activate User</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Send an invitation email to activate this placeholder user. They will be able to log in after completing registration.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    <Trans>User</Trans>
                  </Label>
                  <p className="text-sm font-medium">{userToActivate?.nickname}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activate-email">
                    <Trans>Email</Trans>
                  </Label>
                  <Input
                    id="activate-email"
                    type="email"
                    placeholder={_(t`user@example.com`)}
                    value={activateEmail}
                    onChange={(e) => setActivateEmail(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActivateDialogOpen(false);
                    setUserToActivate(null);
                    setActivateEmail("");
                  }}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleActivatePlaceholderUser} disabled={sendingActivation}>
                  {sendingActivation ? (
                    <Trans>Sending...</Trans>
                  ) : (
                    <Trans>Send Invitation</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirm deactivation/activation dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {userToToggle?.is_active ? (
                    <Trans>Deactivate User</Trans>
                  ) : (
                    <Trans>Activate User</Trans>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {userToToggle?.is_active ? (
                    <Trans>
                      Are you sure you want to deactivate {userToToggle?.nickname}? They will no longer be able to access the application.
                    </Trans>
                  ) : (
                    <Trans>
                      Are you sure you want to activate {userToToggle?.nickname}? They will regain access to the application.
                    </Trans>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDialogOpen(false);
                    setUserToToggle(null);
                  }}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant={userToToggle?.is_active ? "destructive" : "default"}
                  onClick={() => userToToggle && handleToggleUserActive(userToToggle)}
                  disabled={deactivatingUserId === userToToggle?.id}
                >
                  {deactivatingUserId === userToToggle?.id ? (
                    <Trans>Processing...</Trans>
                  ) : userToToggle?.is_active ? (
                    <Trans>Deactivate</Trans>
                  ) : (
                    <Trans>Activate</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete user confirmation dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setUserToDelete(null);
              setDeleteConfirmText("");
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Delete User</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Are you sure you want to permanently delete {userToDelete?.nickname}? This will remove all their data including game history, rankings, and comments. This action cannot be undone.
                  </Trans>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label htmlFor="confirm-nickname">
                  <Trans>
                    Type <strong>{userToDelete?.nickname}</strong> to confirm deletion
                  </Trans>
                </Label>
                <Input
                  id="confirm-nickname"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={_(t`Enter nickname to confirm`)}
                  disabled={deletingUserId === userToDelete?.id}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setUserToDelete(null);
                    setDeleteConfirmText("");
                  }}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => userToDelete && handleDeleteUser(userToDelete)}
                  disabled={
                    deletingUserId === userToDelete?.id ||
                    deleteConfirmText !== userToDelete?.nickname
                  }
                >
                  {deletingUserId === userToDelete?.id ? (
                    <Trans>Deleting...</Trans>
                  ) : (
                    <Trans>Delete Permanently</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active Invitations */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Pending Invitations</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Invitation links that haven't been used yet</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">
                <Trans>Loading...</Trans>
              </p>
            ) : invitations.length === 0 ? (
              <p className="text-muted-foreground">
                <Trans>No pending invitations</Trans>
              </p>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        <Trans>Role: {invitation.role}</Trans> •{" "}
                        <Trans>
                          Expires:{" "}
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </Trans>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvitation(invitation.token)}
                        disabled={resendingToken === invitation.token}
                      >
                        {resendingToken === invitation.token ? (
                          <Trans>Sending...</Trans>
                        ) : (
                          <Trans>Resend</Trans>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = `${import.meta.env.VITE_APP_URL}/invite/${invitation.token}`;
                          navigator.clipboard.writeText(link);
                          toast({
                            title: _(t`Link copied`),
                            description: _(
                              t`Invitation link copied to clipboard`
                            ),
                          });
                        }}
                      >
                        <Trans>Copy Link</Trans>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Users</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>All registered users</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">
                <Trans>Loading...</Trans>
              </p>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground">
                <Trans>No users found</Trans>
              </p>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between border-b pb-4 last:border-0 ${
                      !user.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        nickname={user.nickname}
                        avatarUrl={user.avatar_url}
                        size="lg"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.nickname}</p>
                          {user.is_placeholder && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">
                              <Trans>Placeholder</Trans>
                            </span>
                          )}
                          {!user.is_active && (
                            <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                              <Trans>Inactive</Trans>
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.email || _(t`No email`)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Trans>Last login:</Trans>{" "}
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleString()
                            : _(t`Never`)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.is_placeholder && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Trans>Edit</Trans>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setUserToActivate(user);
                              setActivateDialogOpen(true);
                            }}
                          >
                            <Trans>Activate</Trans>
                          </Button>
                        </>
                      )}
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          handleUpdateUserRole(user.id, value as UserRole)
                        }
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">
                            <Trans>Player</Trans>
                          </SelectItem>
                          <SelectItem value="moderator">
                            <Trans>Moderator</Trans>
                          </SelectItem>
                          <SelectItem value="admin">
                            <Trans>Admin</Trans>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {!user.is_placeholder && (
                        <Button
                          variant={user.is_active ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            setUserToToggle(user);
                            setConfirmDialogOpen(true);
                          }}
                        >
                          {user.is_active ? (
                            <Trans>Deactivate</Trans>
                          ) : (
                            <Trans>Activate</Trans>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trans>Delete</Trans>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
