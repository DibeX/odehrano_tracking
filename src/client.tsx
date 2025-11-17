import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { startTransition } from "react";

startTransition(() => {
  hydrateRoot(document, <StartClient />);
});
