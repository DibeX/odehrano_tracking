import type { BGGGameInfo } from '@/types';

const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';

interface BGGApiResponse {
  items: {
    item: BGGGameItem | BGGGameItem[];
  };
}

interface BGGGameItem {
  $: {
    type: string;
    id: string;
  };
  name: Array<{
    $: {
      type: string;
      value: string;
    };
  }>;
  yearpublished?: Array<{
    $: {
      value: string;
    };
  }>;
  image?: string[];
  link?: Array<{
    $: {
      type: string;
      value: string;
    };
  }>;
  statistics?: Array<{
    ratings: Array<{
      ranks: Array<{
        rank: Array<{
          $: {
            type: string;
            name: string;
            value: string;
          };
        }>;
      }>;
      average: Array<{
        $: {
          value: string;
        };
      }>;
    }>;
  }>;
}

async function parseXML(xmlText: string): Promise<any> {
  // Simple XML parsing for the BGG API response
  // In a production app, consider using a proper XML parser library
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  return xmlDoc;
}

function extractGameData(itemElement: Element): BGGGameInfo {
  const id = parseInt(itemElement.getAttribute('id') || '0');

  // Get primary name and alternate names
  const names = itemElement.getElementsByTagName('name');
  let name = '';
  const alternateNames: string[] = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i].getAttribute('type') === 'primary') {
      name = names[i].getAttribute('value') || '';
    } else if (names[i].getAttribute('type') === 'alternate') {
      const altName = names[i].getAttribute('value');
      if (altName) {
        alternateNames.push(altName);
      }
    }
  }

  // Get year published
  const yearElements = itemElement.getElementsByTagName('yearpublished');
  const yearPublished = yearElements.length > 0
    ? parseInt(yearElements[0].getAttribute('value') || '0')
    : null;

  // Get image
  const imageElements = itemElement.getElementsByTagName('image');
  const imageUrl = imageElements.length > 0 ? imageElements[0].textContent : null;

  // Get categories and publishers
  const categories: string[] = [];
  const publishers: string[] = [];
  const links = itemElement.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const linkType = links[i].getAttribute('type');
    const linkValue = links[i].getAttribute('value');
    if (linkType === 'boardgamecategory' && linkValue) {
      categories.push(linkValue);
    } else if (linkType === 'boardgamepublisher' && linkValue) {
      publishers.push(linkValue);
    }
  }

  // Get rank and rating
  let rank: number | null = null;
  let rating: number | null = null;

  const statistics = itemElement.getElementsByTagName('statistics');
  if (statistics.length > 0) {
    const ranks = statistics[0].getElementsByTagName('rank');
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i].getAttribute('name') === 'boardgame') {
        const rankValue = ranks[i].getAttribute('value');
        rank = rankValue && rankValue !== 'Not Ranked' ? parseInt(rankValue) : null;
        break;
      }
    }

    const averages = statistics[0].getElementsByTagName('average');
    if (averages.length > 0) {
      const ratingValue = averages[0].getAttribute('value');
      rating = ratingValue ? parseFloat(ratingValue) : null;
    }
  }

  return {
    id,
    name,
    alternateNames,
    yearPublished,
    imageUrl,
    categories,
    publishers,
    rank,
    rating,
  };
}

export async function fetchBGGGame(gameId: number): Promise<BGGGameInfo> {
  try {
    const response = await fetch(
      `${BGG_API_BASE}/thing?id=${gameId}&stats=1`,
      {
        headers: {
          'Accept': 'application/xml',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BGG API request failed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const xmlDoc = await parseXML(xmlText);

    const items = xmlDoc.getElementsByTagName('item');
    if (items.length === 0) {
      throw new Error('Game not found');
    }

    return extractGameData(items[0]);
  } catch (error) {
    console.error('Error fetching BGG game:', error);
    throw new Error('Failed to fetch game information from BoardGameGeek');
  }
}

export async function searchBGGGames(query: string): Promise<BGGGameInfo[]> {
  try {
    const response = await fetch(
      `${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`,
      {
        headers: {
          'Accept': 'application/xml',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BGG API request failed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const xmlDoc = await parseXML(xmlText);

    const items = xmlDoc.getElementsByTagName('item');
    const games: BGGGameInfo[] = [];

    for (let i = 0; i < items.length; i++) {
      const id = parseInt(items[i].getAttribute('id') || '0');
      const names = items[i].getElementsByTagName('name');
      const name = names.length > 0 ? names[0].getAttribute('value') || '' : '';

      const yearElements = items[i].getElementsByTagName('yearpublished');
      const yearPublished = yearElements.length > 0
        ? parseInt(yearElements[0].getAttribute('value') || '0')
        : null;

      games.push({
        id,
        name,
        alternateNames: [],
        yearPublished,
        imageUrl: null,
        categories: [],
        publishers: [],
        rank: null,
        rating: null,
      });
    }

    return games;
  } catch (error) {
    console.error('Error searching BGG games:', error);
    throw new Error('Failed to search games on BoardGameGeek');
  }
}
