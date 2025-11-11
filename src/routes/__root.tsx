import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import '@/lib/i18n';
import '@/styles/globals.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <I18nProvider i18n={i18n}>
      <AuthProvider>
        <Outlet />
        <Toaster />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </AuthProvider>
    </I18nProvider>
  );
}
