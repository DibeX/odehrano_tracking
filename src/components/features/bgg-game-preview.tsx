import { Trans } from "@lingui/react/macro";
import type { BGGGameInfo } from "@/types";

export function BGGStats({
  rank,
  rating,
}: {
  rank: number | null;
  rating: number | null;
}) {
  if (rank === null && rating === null) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {rank !== null && (
        <span>
          <Trans>BGG Rank: #{rank}</Trans>
        </span>
      )}
      {rating !== null && (
        <span>
          <Trans>Rating: {rating}/10</Trans>
        </span>
      )}
    </div>
  );
}
export function BGGGamePreview({ game }: { game: BGGGameInfo }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {game.imageUrl && (
          <img
            src={game.imageUrl}
            alt={game.name}
            className="h-32 w-24 shrink-0 rounded object-contain"
          />
        )}
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-semibold break-words">{game.name}</h3>
          {game.yearPublished !== null && (
            <p className="text-sm">
              <Trans>Year: {game.yearPublished}</Trans>
            </p>
          )}
          <BGGStats rank={game.rank} rating={game.rating} />
          <a
            href={`https://boardgamegeek.com/boardgame/${game.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            <Trans>View on BoardGameGeek</Trans>
          </a>
        </div>
      </div>
      {game.alternateNames.length > 0 && (
        <p className="text-sm break-words">
          <strong>
            <Trans>Alternate Names</Trans>:{" "}
          </strong>
          {game.alternateNames.join(", ")}
        </p>
      )}
      {game.publishers.length > 0 && (
        <p className="text-sm break-words">
          <strong>
            <Trans>Publishers</Trans>:{" "}
          </strong>
          {game.publishers.join(", ")}
        </p>
      )}
      {game.categories.length > 0 && (
        <p className="text-sm break-words">
          <strong>
            <Trans>Categories</Trans>:{" "}
          </strong>
          {game.categories.join(", ")}
        </p>
      )}
    </div>
  );
}
