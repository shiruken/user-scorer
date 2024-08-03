import { RedisClient } from "@devvit/public-api";
import { MAX_ITEMS, SCORE_PLACEHOLDER, USERS_KEY } from "./constants.js";
import { UserData } from "./types.js";

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
