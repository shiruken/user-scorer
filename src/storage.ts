import { RedisClient } from "@devvit/public-api";
import { UserV2 } from '@devvit/protos';
import { UserData } from "./types.js";

const USER_KEY = "#users";

export async function getUserData(user: UserV2, redis: RedisClient): Promise<UserData> {
  let hash = await redis.hgetall(user.name);

  // Initialize Redis hash for new user
  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  if (!hash || Object.keys(hash).length === 0) {
    await redis.zAdd(USER_KEY, { member: user.name, score: 0 }); // Add to sorted set of all users
    await redis.hset(user.name, {
      ['id']: user.id,
      ['name']: user.name,
      ['comment_ids']: "[]",
      ['removed_comment_ids']: "[]",
      ['score']: "0",
    });
    console.log(`u/${user.name}: Initialized Redis storage`);
    hash = (await redis.hgetall(user.name))!;
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
  };

  return data;
}

export async function storeUserComments(data: UserData, redis: RedisClient) {
  // Update comments in user hash
  await redis.hset(data.name, {
    ['comment_ids']: JSON.stringify(data.comment_ids),
    ['score']: JSON.stringify(data.score),
  });

  // Update score in sorted set of all users
  await redis.zAdd(USER_KEY, { member: data.name, score: data.score });
}

export async function storeUserRemovedComments(data: UserData, redis: RedisClient) {
  // Update removed comments in user hash
  await redis.hset(data.name, {
    ['removed_comment_ids']: JSON.stringify(data.removed_comment_ids),
    ['score']: JSON.stringify(data.score),
  });

  // Update score in sorted set of all users
  await redis.zAdd(USER_KEY, { member: data.name, score: data.score });
}
