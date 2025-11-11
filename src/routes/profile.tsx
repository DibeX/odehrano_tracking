import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireAuth } from '@/lib/auth-helpers';
import { useAuthContext } from '@/contexts/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function ProfilePage() {
  const { user } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setDescription(user.description || '');
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('users')
        .update({
          nickname,
          description,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: _(t`Profile updated`),
        description: _(t`Your profile has been updated successfully`),
      });
    } catch (error: any) {
      toast({
        title: _(t`Error updating profile`),
        description: error.message,
        variant: 'destructive',
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
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: _(t`Password too short`),
        description: _(t`Password must be at least 8 characters long`),
        variant: 'destructive',
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

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: _(t`Error changing password`),
        description: error.message,
        variant: 'destructive',
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
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Trans>Email</Trans>
                </Label>
                <Input id="email" type="email" value={user?.email || ''} disabled />
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
                <Input value={user?.role || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  <Trans>Contact an admin to change your role</Trans>
                </p>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
              </Button>
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
                {changingPassword ? <Trans>Changing...</Trans> : <Trans>Change Password</Trans>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
