import { useId } from "react";
import { Trans } from "@lingui/react/macro";
import { Label } from "@/components/ui/label";
import type { BGGGameInfo } from "@/types";
import {
  getBGGNames,
  getCzechEditions,
  type BGGEditionSelection as Selection,
} from "@/services/bgg-editions";

export function BGGEditionSelection({
  game,
  selection,
  onChange,
  disabled = false,
}: {
  game: BGGGameInfo;
  selection: Selection;
  onChange: (selection: Selection) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const editions = getCzechEditions(game);
  const names = getBGGNames(game);
  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50";
  return (
    <div className="space-y-3">
      {editions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-edition`}>
            <Trans>Publisher edition</Trans>
          </Label>
          <select
            id={`${id}-edition`}
            className={selectClass}
            value={selection.editionId ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...selection,
                editionId: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          >
            <option value="">
              <Trans>All editions — all publishers</Trans>
            </option>
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.name} — {edition.publishers.join(", ")} (#{edition.id})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            <Trans>
              Czech-language editions are listed here. The selected edition
              determines the publishers.
            </Trans>
          </p>
        </div>
      )}
      {names.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>
            <Trans>Primary game name</Trans>
          </Label>
          <select
            id={`${id}-name`}
            className={selectClass}
            value={selection.name}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...selection, name: event.target.value })
            }
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            <Trans>
              Select the Czech title if available. BGG does not label alternate
              names by language; other titles are kept as alternate names.
            </Trans>
          </p>
        </div>
      )}
    </div>
  );
}
