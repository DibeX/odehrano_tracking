import { createServerFn } from "@tanstack/react-start";
import type { BGGRequest } from "./bgg-contract";

export const bggRequest = createServerFn({ method: "POST" })
  .inputValidator((input: BGGRequest) => input)
  .handler(async ({ data }) => {
    const { runBGGRequest } = await import("./bgg-server");
    return runBGGRequest(data);
  });
