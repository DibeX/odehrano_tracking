import { useEffect, useId, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBGGGame, searchBGGGames } from "@/services/bgg-api";
import { findExistingBGGGame } from "@/services/bgg-library";
import { parseBGGLookup } from "@/services/bgg-metadata";
import { getBGGErrorMessage } from "@/services/bgg-messages";
import type { BGGSearchResult } from "@/services/bgg-contract";
import type { BGGGameInfo } from "@/types";
import { BGGGamePreview } from "./bgg-game-preview";

export function BGGGameSearch({
  onGameSelected,
  disabled = false,
}: {
  onGameSelected: (game: BGGGameInfo) => void;
  disabled?: boolean;
}) {
  const { _ } = useLingui();
  const inputId = useId();
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<BGGSearchResult[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [game, setGame] = useState<BGGGameInfo | null>(null);
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(
    null,
  );
  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );

  async function loadGame(id: number, generation: number) {
    const [metadata, duplicate] = await Promise.all([
      fetchBGGGame(id),
      findExistingBGGGame(id),
    ]);
    if (generation !== requestId.current) return;
    setGame(metadata);
    setExisting(duplicate);
  }
  async function search() {
    const generation = ++requestId.current;
    setBusy(true);
    setError(null);
    setGame(null);
    setExisting(null);
    setResults(null);
    setVisibleCount(50);
    try {
      const lookup = parseBGGLookup(query);
      if (lookup.kind === "game") await loadGame(lookup.id, generation);
      else {
        const matches = await searchBGGGames(lookup.query);
        if (generation === requestId.current) setResults(matches);
      }
    } catch (error) {
      if (generation === requestId.current) setError(error);
    } finally {
      if (generation === requestId.current) setBusy(false);
    }
  }
  async function preview(id: number) {
    const generation = ++requestId.current;
    setBusy(true);
    setError(null);
    setGame(null);
    setExisting(null);
    try {
      await loadGame(id, generation);
    } catch (error) {
      if (generation === requestId.current) setError(error);
    } finally {
      if (generation === requestId.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          <Trans>Game name, BGG ID, or URL</Trans>
        </Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={query}
            disabled={disabled}
            maxLength={200}
            placeholder={_(msg`e.g., Wingspan, 266192, or a BGG game URL`)}
            onChange={(event) => {
              requestId.current++;
              setQuery(event.target.value);
              setBusy(false);
              setResults(null);
              setGame(null);
              setExisting(null);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!busy && !disabled && query.trim()) void search();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => void search()}
            disabled={busy || disabled || !query.trim()}
          >
            <Trans>Search</Trans>
          </Button>
        </div>
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>Loading BGG metadata. This may take a few seconds.</Trans>
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {getBGGErrorMessage(error, _)}
        </p>
      )}
      {results !== null && (
        <div className="space-y-2" aria-live="polite">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Trans>No BGG games found. Try another name or a BGG ID.</Trans>
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <Trans>Select a game to preview its metadata.</Trans>
              </p>
              <ul className="max-h-80 space-y-1 overflow-auto rounded-md border p-2">
                {results.slice(0, visibleCount).map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      disabled={busy || disabled}
                      onClick={() => void preview(result.id)}
                      className="flex w-full items-start justify-between gap-3 rounded p-2 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <span className="break-words">
                        {result.name}
                        {result.yearPublished !== null &&
                          ` (${result.yearPublished})`}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        #{result.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {visibleCount < results.length && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={() => setVisibleCount((count) => count + 50)}
                >
                  <Trans>Show More Results</Trans>
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {game && (
        <div className="space-y-4 rounded-md border p-4">
          <BGGGamePreview game={game} />
          {existing && (
            <p role="status" className="text-sm">
              <Trans>This game is already in your library:</Trans>{" "}
              <a
                href={`/games/edit/${existing.id}`}
                className="text-primary underline"
              >
                {existing.name}
              </a>
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!!existing || disabled || busy}
            onClick={() => onGameSelected(game)}
          >
            <Trans>Use This Game</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
