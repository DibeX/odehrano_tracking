import { useState } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchBGGGame } from '@/services/bgg-api';
import { useToast } from '@/hooks/use-toast';
import type { BGGGameInfo } from '@/types';

interface BGGGameSearchProps {
  onGameSelected: (game: BGGGameInfo) => void;
}

export function BGGGameSearch({ onGameSelected }: BGGGameSearchProps) {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [bggId, setBggId] = useState('');
  const [searching, setSearching] = useState(false);
  const [gameInfo, setGameInfo] = useState<BGGGameInfo | null>(null);

  async function handleSearch() {
    if (!bggId.trim()) {
      toast({
        title: _(t`BGG ID required`),
        description: _(t`Please enter a BoardGameGeek game ID`),
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    try {
      const info = await fetchBGGGame(parseInt(bggId));
      setGameInfo(info);
    } catch (error: any) {
      toast({
        title: _(t`Error fetching game`),
        description: error.message,
        variant: 'destructive',
      });
      setGameInfo(null);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectGame() {
    if (gameInfo) {
      onGameSelected(gameInfo);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bggId">
          <Trans>BoardGameGeek ID</Trans>
        </Label>
        <div className="flex gap-2">
          <Input
            id="bggId"
            type="number"
            placeholder={_(t`Enter BGG game ID (e.g., 174430)`)}
            value={bggId}
            onChange={(e) => setBggId(e.target.value)}
            disabled={searching}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <Button onClick={handleSearch} disabled={searching || !bggId.trim()}>
            {searching ? <Trans>Searching...</Trans> : <Trans>Search</Trans>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <Trans>Find the game ID on BoardGameGeek.com in the URL (e.g., /boardgame/174430/gloomhaven)</Trans>
        </p>
      </div>

      {gameInfo && (
        <Card>
          <CardHeader>
            <CardTitle>{gameInfo.name}</CardTitle>
            <CardDescription>
              {gameInfo.yearPublished && <Trans>Year: {gameInfo.yearPublished}</Trans>}
              {gameInfo.rank && (
                <>
                  {' • '}
                  <Trans>BGG Rank: #{gameInfo.rank}</Trans>
                </>
              )}
              {gameInfo.rating && (
                <>
                  {' • '}
                  <Trans>Rating: {gameInfo.rating}/10</Trans>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gameInfo.imageUrl && (
              <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                <img
                  src={gameInfo.imageUrl}
                  alt={gameInfo.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {gameInfo.categories.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  <Trans>Categories:</Trans>
                </p>
                <div className="flex flex-wrap gap-2">
                  {gameInfo.categories.map((category) => (
                    <span
                      key={category}
                      className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSelectGame} className="w-full">
              <Trans>Use This Game</Trans>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
