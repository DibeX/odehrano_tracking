import {
  createRootRoute,
  Outlet,
  Scripts,
  HeadContent,
  Link,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/lib/i18n";
import "@/styles/globals.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/client-only";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          <ThemeProvider>
            <AuthProvider>
              <TooltipProvider delayDuration={0}>
                <ScrollArea className="h-dvh">
                  <Outlet />
                </ScrollArea>
                <ClientOnly>
                  <Toaster />
                </ClientOnly>
                {import.meta.env.DEV && (
                  <ClientOnly>
                    <TanStackRouterDevtools />
                  </ClientOnly>
                )}
              </TooltipProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="mb-4 text-4xl font-bold">404</h1>
      <p className="mb-6 text-muted-foreground">Page not found</p>
      <a href="/">
        <Button variant={"outline"}>Go back home</Button>
      </a>
    </div>
  );
}
