import { RedisClient } from "@devvit/public-api";
import { MAX_ITEMS, SCORE_PLACEHOLDER, USERS_KEY } from "./constants.js";
import { Histogram, UserData } from "./types.js";

/**
 * Initializes Redis storage for user
 * @param username A Reddit username
 * @param id A Reddit user thing ID (t2_*)
 * @param redis A RedisClient object
 * @returns A Promise that resolves to a {@link UserData} object
 */
export async function initUserData(username: string, id: string, redis: RedisClient): Promise<UserData> {
  // Initialize Redis hash
  await redis.hset(username, {
    ['id']: id,
    ['name']: username,
    ['comment_ids']: "[]",
    ['removed_comment_ids']: "[]",
    ['score']: `${SCORE_PLACEHOLDER}`,
    ['numComments_for_score']: "0",
  });

  // Add to sorted set of all users
  await redis.zAdd(USERS_KEY, { member: username, score: SCORE_PLACEHOLDER });

  const data = await getUserData(username, redis);
  if (!data) {
    throw new Error(`u/${username}: Failed to initialize Redis storage`);
  }
  console.log(`u/${username}: Initialized Redis storage`);
  return data;
}

/**
 * Read user data from Redis
 * @param username A Reddit username
 * @param redis A RedisClient object
 * @returns A Promise that resolves to a {@link UserData} object if the user exists
 */
export async function getUserData(username: string, redis: RedisClient): Promise<UserData | undefined> {
  let hash = await redis.hgetall(username);

  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  if (!hash || Object.keys(hash).length === 0) {
    return undefined;
  }

  // Ideally we would just store the whole UserData object as JSON
  // in Redis. However, because there is a risk for race conditions 
  // between the CommentSubmit and ModAction triggers, we need to be 
  // able to independently set the values of `comment_ids` and 
  // `removed_comment_ids` without writing the whole UserData object.
  // This necessitates use of a Redis hash and this somewhat kludge
  // parsing of its contents back into a UserData object.
  const data: UserData = {
    id: hash.id,
    name: hash.name,
    comment_ids: JSON.parse(hash.comment_ids),
    removed_comment_ids: JSON.parse(hash.removed_comment_ids),
    score: Number(hash.score),
    numComments_for_score: Number(hash.numComments_for_score),
  };

  return data;
}

/**
 * Write comments and score for user to Redis
 * @param data A {@link UserData} object
 * @param redis A RedisClient object
 */
export async function storeComments(data: UserData, redis: RedisClient) {
  // Update comments and score in user hash
  await redis.hset(data.name, {
    ['comment_ids']: JSON.stringify(data.comment_ids),
    ['score']: JSON.stringify(data.score),
    ['numComments_for_score']: JSON.stringify(data.numComments_for_score),
  });

  // Update score in sorted set of all users
  await redis.zAdd(USERS_KEY, { member: data.name, score: data.score });
}

/**
 * Write removed comments and score for user to Redis
 * @param data A {@link UserData} object
 * @param redis A RedisClient object
 */
export async function storeRemovedComments(data: UserData, redis: RedisClient) {
  // Update removed comments and score in user hash
  await redis.hset(data.name, {
    ['removed_comment_ids']: JSON.stringify(data.removed_comment_ids),
    ['score']: JSON.stringify(data.score),
    ['numComments_for_score']: JSON.stringify(data.numComments_for_score),
  });

  // Update score in sorted set of all users
  await redis.zAdd(USERS_KEY, { member: data.name, score: data.score });
}

/**
 * Generate histogram of all current User Scorer data
 * 
 * The histogram is split into 13 bins:
 * 
 *           x = -1.0 (Unassigned)
 *           x = 0.0
 *     0.0 < x ≤ 0.1
 *     0.1 < x ≤ 0.2
 *     0.2 < x ≤ 0.3
 *     0.3 < x ≤ 0.4
 *     0.4 < x ≤ 0.5
 *     0.5 < x ≤ 0.6
 *     0.6 < x ≤ 0.7
 *     0.7 < x ≤ 0.8
 *     0.8 < x ≤ 0.9
 *     0.9 < x < 1.0 (Exclude 1.0)
 *           x = 1.0
 * 
 * @param redis A RedisClient object
 * @returns A Promise that resolves to a {@link Histogram} object
 */
export async function getHistogram(redis: RedisClient): Promise<Histogram> {
  const histogram: Histogram = {
    count: 0,
    bins: [
      { range: [-1.0],       label: "      x =-1.0", count: 0 }, // Unassigned
      { range: [0],          label: "      x = 0.0", count: 0 },
      { range: [0.0, 0.1],   label: "0.0 < x ≤ 0.1", count: 0 },
      { range: [0.1, 0.2],   label: "0.1 < x ≤ 0.2", count: 0 },
      { range: [0.2, 0.3],   label: "0.2 < x ≤ 0.3", count: 0 },
      { range: [0.3, 0.4],   label: "0.3 < x ≤ 0.4", count: 0 },
      { range: [0.4, 0.5],   label: "0.4 < x ≤ 0.5", count: 0 },
      { range: [0.5, 0.6],   label: "0.5 < x ≤ 0.6", count: 0 },
      { range: [0.6, 0.7],   label: "0.6 < x ≤ 0.7", count: 0 },
      { range: [0.7, 0.8],   label: "0.7 < x ≤ 0.8", count: 0 },
      { range: [0.8, 0.9],   label: "0.8 < x ≤ 0.9", count: 0 },
      { range: [0.9, 0.999], label: "0.9 < x < 1.0", count: 0 }, // 0.999 is max value possible with limit
      { range: [1.0],        label: "      x = 1.0", count: 0 },
    ],
    is_complete: true,
  }

  // Get all user scores and calculate histogram
  let cursor = 0;
  let calls = 0;
  do {
    const zScanResponse = await redis.zScan(USERS_KEY, cursor, undefined, 100);
    for (const user of zScanResponse.members) {
      histogram.count++;
      for (let i = 0; i < histogram.bins.length; i++) {
        if (histogram.bins[i].range.length == 1) { // Single-value bins
          if (user.score == histogram.bins[i].range[0]) {
            histogram.bins[i].count++;
            break;
          }
        } else { // Ranged bins
          if (user.score > histogram.bins[i].range[0] && user.score <= histogram.bins[i].range[1]) {
            histogram.bins[i].count++;
            break;
          }
        }
      }
    }
    cursor = zScanResponse.cursor;
    calls++;
  } while (cursor != 0);

  console.log(`Processed ${histogram.count} users across ${calls} calls`);

  const count = await redis.zCard(USERS_KEY);
  if (count != histogram.count) {
    histogram.is_complete = false;
    console.error(`Mismatch between sorted set cardinality (${count}) ` +
                  `and number of items processed (${histogram.count})`);
  }

  // Log summary to console
  let txt = `\n\n` +
    `Tracked Users: ${histogram.count}${
      histogram.is_complete ? "" : " (Warning! Failed to process all users)"
    }\n` +
    `Scored Users: ${histogram.count - histogram.bins[0].count}\n` +
    `Unscored Users: ${histogram.bins[0].count}\n` +
    `-----------------\n`;
  histogram.bins.slice(1).forEach(bin => {
    txt += `${bin.label}: ${bin.count}\n`;
  });
  txt += `-----------------\n`;
  console.log(txt);

  return histogram;
}

/**
 * Trim array to adhere to item tracking limit
 * @param array String array to trim
 * @returns Trimmed string array
 */
export function trimArray(array: string[]): string[] {
  while (array.length > MAX_ITEMS) {
    const id = array.shift();
    console.log(`Purged ${id} from tracking`);
  }
  return array;
}
