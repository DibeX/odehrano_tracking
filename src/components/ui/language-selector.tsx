import { useState, useEffect } from "react";
import { Languages } from "lucide-react";
import { useLingui } from "@lingui/react";
import { Button } from "@/components/ui/button";
import { locales, loadCatalog } from "@/lib/i18n";

const STORAGE_KEY = "odehrano-locale";

export function LanguageSelector() {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);

  useEffect(() => {
    const savedLocale = localStorage.getItem(STORAGE_KEY);
    if (savedLocale && savedLocale !== i18n.locale && savedLocale in locales) {
      loadCatalog(savedLocale).then(() => {
        setCurrentLocale(savedLocale);
      });
    }
  }, [i18n.locale]);

  async function handleLocaleChange(locale: string) {
    await loadCatalog(locale);
    localStorage.setItem(STORAGE_KEY, locale);
    setCurrentLocale(locale);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <Languages className="h-4 w-4" />
        <span className="sr-only">Change language</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="flex flex-col gap-1">
              {Object.entries(locales).map(([code, name]) => (
                <Button
                  key={code}
                  variant={currentLocale === code ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => handleLocaleChange(code)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
