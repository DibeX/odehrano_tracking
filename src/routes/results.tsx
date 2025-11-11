import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireAuth } from '@/lib/auth-helpers';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { calculateRankings, getSchemeDisplayName, getSchemeDescription } from '@/services/ranking-calculator';
import type { RankingScheme, RankingYear, User, BoardGame, UserGameRanking, RankingResult } from '@/types';

export const Route = createFileRoute('/results')({
  component: ResultsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      year: search.year ? Number(search.year) : undefined,
    };
  },
});

function ResultsPage() {
  const { year: searchYear } = Route.useSearch();
  const { _ } = useLingui();
  const { toast } = useToast();
  const [years, setYears] = useState<RankingYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(searchYear || null);
  const [selectedScheme, setSelectedScheme] = useState<RankingScheme>('damped');
  const [results, setResults] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      calculateResults();
    }
  }, [selectedYear, selectedScheme]);

  async function loadYears() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ranking_years')
        .select('*')
        .eq('is_public', true)
        .order('year', { ascending: false });

      if (error) throw error;

      setYears(data || []);
      if (data && data.length > 0 && !selectedYear) {
        setSelectedYear(data[0].year);
      }
    } catch (error: any) {
      toast({
        title: _(t`Error loading years`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function calculateResults() {
    if (!selectedYear) return;

    setCalculating(true);
    try {
      // Load all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) throw usersError;

      // Load all rankings for the year
      const { data: rankings, error: rankingsError } = await supabase
        .from('user_game_rankings')
        .select('*')
        .eq('year', selectedYear);

      if (rankingsError) throw rankingsError;

      // Get unique game IDs
      const gameIds = Array.from(new Set(rankings?.map(r => r.board_game_id) || []));

      // Load game details
      const { data: games, error: gamesError } = await supabase
        .from('board_games')
        .select('*')
        .in('id', gameIds);

      if (gamesError) throw gamesError;

      // Calculate rankings
      const calculated = calculateRankings(
        users as User[],
        games as BoardGame[],
        rankings as UserGameRanking[],
        selectedScheme
      );

      setResults(calculated);
    } catch (error: any) {
      toast({
        title: _(t`Error calculating results`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCalculating(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              <Trans>Loading...</Trans>
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (years.length === 0) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                <Trans>No public results available yet</Trans>
              </p>
              <p className="text-sm text-muted-foreground">
                <Trans>Results will appear here once an admin publishes them</Trans>
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Trans>Ranking Results</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>View calculated game rankings based on player votes</Trans>
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              <Trans>Year</Trans>
            </label>
            <Select
              value={selectedYear?.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.year.toString()}>
                    {year.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              <Trans>Ranking Scheme</Trans>
            </label>
            <Select
              value={selectedScheme}
              onValueChange={(value) => setSelectedScheme(value as RankingScheme)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">
                  <Trans>Equal per Player</Trans>
                </SelectItem>
                <SelectItem value="damped">
                  <Trans>Damped (Recommended)</Trans>
                </SelectItem>
                <SelectItem value="linear">
                  <Trans>Linear by Experience</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{getSchemeDisplayName(selectedScheme)}</CardTitle>
            <CardDescription>{getSchemeDescription(selectedScheme)}</CardDescription>
          </CardHeader>
        </Card>

        {calculating ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Calculating rankings...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>No rankings data available for this year</Trans>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Card key={result.game.id} className={index < 3 ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{result.game.name}</CardTitle>
                      <CardDescription>
                        {result.game.year_published && (
                          <span>
                            <Trans>Year: {result.game.year_published}</Trans>
                          </span>
                        )}
                        {result.tieBreakInfo && (
                          <>
                            {' • '}
                            <span>
                              <Trans>{result.tieBreakInfo.firstPlaceVotes} first-place votes</Trans>
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {result.normalizedScore.toFixed(4)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Trans>Score</Trans>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="text-sm font-medium mb-3">
                      <Trans>Player Rankings:</Trans>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {result.playerContributions.map((contrib) => (
                        <div
                          key={contrib.user.id}
                          className="flex items-center justify-between p-2 bg-secondary rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contrib.user.nickname}</span>
                            <span className="text-xs text-muted-foreground">
                              (#{contrib.rank})
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {contrib.contribution.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
