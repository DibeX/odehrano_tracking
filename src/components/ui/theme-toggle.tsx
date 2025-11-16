import { Moon, Sun, Monitor } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Trans } from "@lingui/react/macro";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {resolvedTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="flex flex-col gap-1">
              <Button
                variant={theme === "light" ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => {
                  setTheme("light");
                  setOpen(false);
                }}
              >
                <Sun className="mr-2 h-4 w-4" />
                <Trans>Light</Trans>
              </Button>
              <Button
                variant={theme === "dark" ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => {
                  setTheme("dark");
                  setOpen(false);
                }}
              >
                <Moon className="mr-2 h-4 w-4" />
                <Trans>Dark</Trans>
              </Button>
              <Button
                variant={theme === "system" ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => {
                  setTheme("system");
                  setOpen(false);
                }}
              >
                <Monitor className="mr-2 h-4 w-4" />
                <Trans>System</Trans>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
