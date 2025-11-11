import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireRole } from '@/lib/auth-helpers';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { generateToken, getExpirationDate } from '@/lib/utils';
import type { User, UserInvitation, UserRole } from '@/types';

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
  beforeLoad: async () => {
    await requireRole('admin');
  },
});

function UsersPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('player');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResult, invitationsResult] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase
          .from('user_invitations')
          .select('*')
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (invitationsResult.error) throw invitationsResult.error;

      setUsers(usersResult.data || []);
      setInvitations(invitationsResult.data || []);
    } catch (error: any) {
      toast({
        title: _(t`Error loading data`),
        description: error.message,
        variant: 'destructive',
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
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const token = generateToken();
      const expiresAt = getExpirationDate(14);

      const { error } = await supabase.from('user_invitations').insert({
        email: inviteEmail,
        token,
        role: inviteRole,
        created_by: session.session.user.id,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      const inviteLink = `${import.meta.env.VITE_APP_URL}/invite/${token}`;

      toast({
        title: _(t`Invitation created`),
        description: (
          <div className="space-y-2">
            <p>
              <Trans>Invitation link created for {inviteEmail}</Trans>
            </p>
            <div className="rounded bg-muted p-2 text-xs break-all">
              {inviteLink}
            </div>
            <p className="text-xs text-muted-foreground">
              <Trans>Send this link to the user. It expires in 14 days.</Trans>
            </p>
          </div>
        ),
      });

      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('player');
      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error creating invitation`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: UserRole) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

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
        variant: 'destructive',
      });
    }
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
                  <Trans>Send an invitation link to a new user. The link will expire in 14 days.</Trans>
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
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
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
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleCreateInvitation} disabled={inviting}>
                  {inviting ? <Trans>Creating...</Trans> : <Trans>Create Invitation</Trans>}
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
                  <div key={invitation.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        <Trans>Role: {invitation.role}</Trans> • <Trans>Expires: {new Date(invitation.expires_at).toLocaleDateString()}</Trans>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = `${import.meta.env.VITE_APP_URL}/invite/${invitation.token}`;
                        navigator.clipboard.writeText(link);
                        toast({
                          title: _(t`Link copied`),
                          description: _(t`Invitation link copied to clipboard`),
                        });
                      }}
                    >
                      <Trans>Copy Link</Trans>
                    </Button>
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
                  <div key={user.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                        {user.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.nickname}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleUpdateUserRole(user.id, value as UserRole)}
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
