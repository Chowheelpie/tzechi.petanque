import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const channelId = 'UCtuaDBqzzl-h9XHtZcODfCQ';
const apiKey = process.env.YOUTUBE_API_KEY;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../data/youtube-stats.json');

if (!apiKey) {
  throw new Error('YOUTUBE_API_KEY is required. Add it as a GitHub Actions secret before running this script.');
}

const endpoint = new URL('https://www.googleapis.com/youtube/v3/channels');
endpoint.search = new URLSearchParams({
  part: 'statistics',
  id: channelId,
  key: apiKey
}).toString();

const response = await fetch(endpoint);
if (!response.ok) {
  throw new Error(`YouTube Data API request failed (${response.status}): ${await response.text()}`);
}

const payload = await response.json();
const statistics = payload.items?.[0]?.statistics;
if (!statistics || !/^\d+$/.test(statistics.viewCount ?? '')) {
  throw new Error('YouTube Data API response did not contain valid channel statistics.');
}

const hiddenSubscriberCount = Boolean(statistics.hiddenSubscriberCount);
if (!hiddenSubscriberCount && !/^\d+$/.test(statistics.subscriberCount ?? '')) {
  throw new Error('YouTube Data API response did not contain a valid subscriber count.');
}

const nextStats = {
  channelId,
  viewCount: Number(statistics.viewCount),
  subscriberCount: hiddenSubscriberCount ? null : Number(statistics.subscriberCount),
  hiddenSubscriberCount,
  updatedAt: new Date().toISOString()
};

let existingStats = null;
try {
  existingStats = JSON.parse(await readFile(outputPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const valuesChanged = !existingStats ||
  existingStats.viewCount !== nextStats.viewCount ||
  existingStats.subscriberCount !== nextStats.subscriberCount ||
  existingStats.hiddenSubscriberCount !== nextStats.hiddenSubscriberCount;

if (valuesChanged) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(nextStats, null, 2)}\n`);
  console.log('YouTube statistics updated.');
} else {
  console.log('YouTube statistics are unchanged.');
}
