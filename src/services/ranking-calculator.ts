import type { RankingScheme, RankingResult, User, BoardGame, UserGameRanking } from '@/types';

interface PlayerRanking {
  user: User;
  gameRankings: Map<string, number>; // boardGameId -> rank
}

interface GameScore {
  boardGame: BoardGame;
  score: number;
  normalizedScore: number;
  playerContributions: {
    user: User;
    rank: number;
    contribution: number;
  }[];
  firstPlaceVotes: number;
  topTwoVotes: number;
}

/**
 * Calculate base fraction for a player's ranking
 * raw_points_p(r) = np − r + 1
 * S_p = np*(np+1)/2
 * base_fraction_p(r) = raw_points_p(r) / S_p
 */
function calculateBaseFraction(rank: number, totalGames: number): number {
  const rawPoints = totalGames - rank + 1;
  const sumPoints = (totalGames * (totalGames + 1)) / 2;
  return rawPoints / sumPoints;
}

/**
 * Calculate weight for a player based on scheme
 */
function calculateWeight(totalGames: number, scheme: RankingScheme): number {
  switch (scheme) {
    case 'equal':
      return 1;
    case 'damped':
      return Math.sqrt(totalGames);
    case 'linear':
      return totalGames;
  }
}

/**
 * Calculate rankings for a given year using the specified scheme
 */
export function calculateRankings(
  players: User[],
  games: BoardGame[],
  rankings: UserGameRanking[],
  scheme: RankingScheme
): RankingResult[] {
  // Build player ranking maps
  const playerRankings: Map<string, PlayerRanking> = new Map();

  players.forEach((player) => {
    const gameRankings = new Map<string, number>();
    rankings
      .filter((r) => r.user_id === player.id)
      .forEach((r) => {
        gameRankings.set(r.board_game_id, r.rank);
      });

    playerRankings.set(player.id, {
      user: player,
      gameRankings,
    });
  });

  // Calculate scores for each game
  const gameScores: Map<string, GameScore> = new Map();

  games.forEach((game) => {
    let totalScore = 0;
    let totalWeight = 0;
    const contributions: GameScore['playerContributions'] = [];
    let firstPlaceVotes = 0;
    let topTwoVotes = 0;

    playerRankings.forEach((playerRanking) => {
      const rank = playerRanking.gameRankings.get(game.id);
      if (rank === undefined) {
        // Player didn't rank this game
        return;
      }

      const totalGames = playerRanking.gameRankings.size;
      const baseFraction = calculateBaseFraction(rank, totalGames);
      const weight = calculateWeight(totalGames, scheme);
      const contribution = baseFraction * weight;

      totalScore += contribution;
      totalWeight += weight;

      contributions.push({
        user: playerRanking.user,
        rank,
        contribution,
      });

      // Tie-breaking metrics
      if (rank === 1) {
        firstPlaceVotes++;
      }
      if (rank <= 2) {
        topTwoVotes++;
      }
    });

    if (contributions.length > 0) {
      gameScores.set(game.id, {
        boardGame: game,
        score: totalScore,
        normalizedScore: totalScore / totalWeight,
        playerContributions: contributions.sort((a, b) => a.rank - b.rank),
        firstPlaceVotes,
        topTwoVotes,
      });
    }
  });

  // Sort games by score with tie-breaking
  const sortedScores = Array.from(gameScores.values()).sort((a, b) => {
    // Primary: higher normalized score wins
    if (Math.abs(a.normalizedScore - b.normalizedScore) > 0.0001) {
      return b.normalizedScore - a.normalizedScore;
    }

    // Tie-break 1: more first-place votes wins
    if (a.firstPlaceVotes !== b.firstPlaceVotes) {
      return b.firstPlaceVotes - a.firstPlaceVotes;
    }

    // Tie-break 2: more top-2 votes wins
    if (a.topTwoVotes !== b.topTwoVotes) {
      return b.topTwoVotes - a.topTwoVotes;
    }

    // Tie-break 3: head-to-head comparison
    // Count how many voters ranked A higher than B vs B higher than A
    let aWins = 0;
    let bWins = 0;

    const aContributions = new Map(
      a.playerContributions.map((c) => [c.user.id, c.rank])
    );
    const bContributions = new Map(
      b.playerContributions.map((c) => [c.user.id, c.rank])
    );

    // Only compare among voters who ranked both games
    aContributions.forEach((aRank, userId) => {
      const bRank = bContributions.get(userId);
      if (bRank !== undefined) {
        if (aRank < bRank) {
          aWins++;
        } else if (bRank < aRank) {
          bWins++;
        }
      }
    });

    if (aWins !== bWins) {
      return bWins - aWins;
    }

    // Tie-break 4: alphabetical by name
    return a.boardGame.name.localeCompare(b.boardGame.name);
  });

  return sortedScores.map((score) => ({
    game: score.boardGame,
    score: score.score,
    normalizedScore: score.normalizedScore,
    playerContributions: score.playerContributions,
    tieBreakInfo: {
      firstPlaceVotes: score.firstPlaceVotes,
      topTwoVotes: score.topTwoVotes,
    },
  }));
}

/**
 * Get scheme display name
 */
export function getSchemeDisplayName(scheme: RankingScheme): string {
  switch (scheme) {
    case 'equal':
      return 'Equal per Player (One Person = One Vote)';
    case 'damped':
      return 'Damped by Experience (Recommended)';
    case 'linear':
      return 'Linear by Games Played';
  }
}

/**
 * Get scheme description
 */
export function getSchemeDescription(scheme: RankingScheme): string {
  switch (scheme) {
    case 'equal':
      return 'Each player has equal voting weight (w_p = 1). Best for giving everyone an equal voice regardless of participation.';
    case 'damped':
      return 'Player weight is square root of games played (w_p = √np). Recommended compromise that values experience while not overpowering casual voters.';
    case 'linear':
      return 'Player weight proportional to games played (w_p = np). Gives more weight to players who participated more throughout the year.';
  }
}
