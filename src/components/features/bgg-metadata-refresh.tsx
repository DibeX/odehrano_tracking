import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/components/ui/button";
import { fetchBGGGame } from "@/services/bgg-api";
import {
  applyBGGChanges,
  buildBGGChanges,
  parseBGGLookup,
  type BGGMetadata,
  type BGGMetadataChange,
  type BGGMetadataField,
} from "@/services/bgg-metadata";
import { BGGError } from "@/services/bgg-contract";
import { BGG_FIELD_LABELS, getBGGErrorMessage } from "@/services/bgg-messages";
import type { BGGGameInfo } from "@/types";
import { BGGEditionSelection } from "./bgg-edition-selection";
import {
  defaultBGGEditionSelection,
  selectBGGEdition,
  type BGGEditionSelection as Selection,
} from "@/services/bgg-editions";

function display(value: BGGMetadataChange["before"]): string {
  return Array.isArray(value) ? value.join(", ") : (value?.toString() ?? "—");
}
export function BGGMetadataRefresh({
  bggId,
  current,
  onApply,
  disabled = false,
}: {
  bggId: string;
  current: BGGMetadata;
  onApply: (metadata: BGGMetadata, fields: BGGMetadataField[]) => void;
  disabled?: boolean;
}) {
  const { _ } = useLingui();
  const generation = useRef(0);
  const selectionOverrides = useRef(new Map<BGGMetadataField, boolean>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [changes, setChanges] = useState<BGGMetadataChange[] | null>(null);
  const [source, setSource] = useState<BGGGameInfo | null>(null);
  const [selection, setSelection] = useState<Selection>({
    name: "",
    editionId: null,
  });
  // A preview belongs to the form values it was requested for, including unsaved edits.
  const fingerprint = JSON.stringify(current);
  useEffect(() => {
    generation.current++;
    selectionOverrides.current.clear();
    setChanges(null);
    setSource(null);
    setBusy(false);
    setError(null);
    return () => {
      generation.current++;
    };
  }, [bggId, fingerprint]);

  async function refresh() {
    const request = ++generation.current;
    selectionOverrides.current.clear();
    setBusy(true);
    setError(null);
    setChanges(null);
    setSource(null);
    try {
      const lookup = parseBGGLookup(bggId);
      if (lookup.kind !== "game") throw new BGGError("INVALID_INPUT");
      const game = await fetchBGGGame(lookup.id, { refresh: true });
      if (request === generation.current) {
        const nextSelection = defaultBGGEditionSelection(game, current);
        setSource(game);
        setSelection(nextSelection);
        setChanges(
          buildBGGChanges(current, selectBGGEdition(game, nextSelection)),
        );
      }
    } catch (error) {
      if (request === generation.current) setError(error);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-md border p-4">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy || !bggId.trim()}
        onClick={() => void refresh()}
      >
        <Trans>Refresh from BGG</Trans>
      </Button>
      <p className="text-xs text-muted-foreground">
        <Trans>
          Review BGG changes before applying them. Save the form to update your
          library.
        </Trans>
      </p>
      {busy && (
        <p role="status" className="text-sm">
          <Trans>Loading BGG metadata. This may take a few seconds.</Trans>
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {getBGGErrorMessage(error, _)}
        </p>
      )}
      {source && changes !== null && (
        <BGGEditionSelection
          game={source}
          selection={selection}
          disabled={disabled}
          onChange={(next) => {
            setSelection(next);
            setChanges(
              buildBGGChanges(current, selectBGGEdition(source, next)).map(
                (change) => ({
                  ...change,
                  selected:
                    selectionOverrides.current.get(change.field) ??
                    change.selected,
                }),
              ),
            );
          }}
        />
      )}
      {changes !== null &&
        (changes.length === 0 ? (
          <p role="status" className="text-sm">
            <Trans>No new BGG metadata is available.</Trans>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <Trans>
                Your current name and image are kept unless you select their
                replacements.
              </Trans>
            </p>
            <div className="max-h-96 space-y-2 overflow-auto">
              {changes.map((change) => (
                <label
                  key={change.field}
                  className="flex items-start gap-3 rounded border p-3"
                >
                  <input
                    type="checkbox"
                    checked={change.selected}
                    disabled={disabled}
                    className="mt-1"
                    onChange={(event) => {
                      selectionOverrides.current.set(
                        change.field,
                        event.target.checked,
                      );
                      setChanges((all) =>
                        all!.map((item) =>
                          item.field === change.field
                            ? { ...item, selected: event.target.checked }
                            : item,
                        ),
                      );
                    }}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">
                      {_(BGG_FIELD_LABELS[change.field])}
                    </span>
                    <span className="block break-words text-muted-foreground">
                      <Trans>Current:</Trans> {display(change.before)}
                    </span>
                    <span className="block break-words">
                      <Trans>BGG:</Trans> {display(change.after)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  disabled || !changes.some((change) => change.selected)
                }
                onClick={() => {
                  const selected = changes.filter((change) => change.selected);
                  onApply(
                    applyBGGChanges(current, selected),
                    selected.map((change) => change.field),
                  );
                  setChanges(null);
                }}
              >
                <Trans>Apply Selected Changes</Trans>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChanges(null)}
              >
                <Trans>Discard BGG Changes</Trans>
              </Button>
            </div>
          </>
        ))}
    </div>
  );
}
