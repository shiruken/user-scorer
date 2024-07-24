import { RedisClient, TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction, UserV2 } from '@devvit/protos';

export async function onCommentSubmit(event: CommentSubmit, context: TriggerContext) {
  const comment = event.comment;
  if (!comment) {
    throw new Error('Missing `comment` in onCommentSubmit');
  }

  const user = event.author;
  if (!user) {
    throw new Error('Missing `user` in onCommentSubmit');
  }

  const data = await getUserData(user, context.redis);

  if (data.comment_ids.includes(comment.id)) {
    console.log(`u/${user.name}: Skipped ${comment.id}, already tracked`);
    return;
  }

  data.comment_ids.push(comment.id);
  data.score = calculateScore(data);
  await context.redis.hset(user.name, {
    ['comment_ids']: JSON.stringify(data.comment_ids),
    ['score']: JSON.stringify(data.score),
  });
  console.log(`u/${user.name}: Added ${comment.id} ` +
              `(comments=${data.comment_ids.length}, ` + 
              `removed=${data.removed_comment_ids.length}, ` +
              `score=${data.score})`);

  const data_updated = await context.redis.hgetall(user.name);
  console.log(`u/${user.name} user data:\n${JSON.stringify(data_updated, null, 2)}`);
}

export async function onModAction(event: ModAction, context: TriggerContext) {
  const action = event.action;
  if (!action) {
    throw new Error('Missing `action` in onModAction');
  }

  if (action != "removecomment" && action != "spamcomment" && action != "approvecomment") {
    console.log(`Skipping ${action} ModAction`);
    return;
  }

  const comment = event.targetComment;
  if (!comment) {
    throw new Error('Missing `comment` in onModAction');
  }

  const user = event.targetUser;
  if (!user) {
    throw new Error('Missing `user` in onModAction');
  }

  const data = await getUserData(user, context.redis);

  if (data.comment_ids.length === 0) {
    throw new Error(`u/${user.name}: No comments tracked`);
  }

  if (!(data.comment_ids.includes(comment.id))) {
    console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, missing from comment_ids`);
    return;
  }

  if (action == "removecomment" || action == "spamcomment") {
    if (!data.removed_comment_ids.includes(comment.id)) {
      data.removed_comment_ids.push(comment.id);
      data.score = calculateScore(data);
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(data.removed_comment_ids),
        ['score']: JSON.stringify(data.score),
      });
      console.log(`u/${user.name}: ${action} on ${comment.id} ` +
                  `(comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, ` +
                  `score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, already tracked`);
    }
  }
  
  if (action == "approvecomment" && data.removed_comment_ids.includes(comment.id)) {
    if (data.removed_comment_ids.includes(comment.id)) {
      const index = data.removed_comment_ids.indexOf(comment.id);
      data.removed_comment_ids.splice(index, 1);
      data.score = calculateScore(data);
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(data.removed_comment_ids),
        ['score']: JSON.stringify(data.score),
      });
      console.log(`u/${user.name}: ${action} on ${comment.id} ` +
                  `(comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, ` +
                  `score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, not tracked`);
    }
  }

  const data_updated = await context.redis.hgetall(user.name);
  console.log(`u/${user.name} user data:\n${JSON.stringify(data_updated, null, 2)}`);
}

type UserData = {
  id: string,
  name: string,
  comment_ids: string[],
  removed_comment_ids: string[],
  score: number,
};

async function getUserData(user: UserV2, redis: RedisClient): Promise<UserData> {
  let hash = await redis.hgetall(user.name);

  // Initialize Redis hash for user
  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  if (!hash || Object.keys(hash).length === 0) {
    await redis.hset(user.name, {
      ['id']: user.id,
      ['name']: user.name,
      ['comment_ids']: "[]",
      ['removed_comment_ids']: "[]",
      ['score']: "0",
    });
    console.log(`u/${user.name}: Initialized Redis hash`);
    hash = (await redis.hgetall(user.name))!;
  }

  const data: UserData = {
    id: hash.id,
    name: hash.name,
    comment_ids: JSON.parse(hash.comment_ids),
    removed_comment_ids: JSON.parse(hash.removed_comment_ids),
    score: Number(hash.score),
  };

  return data;
}

function calculateScore(data: UserData, limit: number=5): number {
  const ids = data.comment_ids.slice(-limit);
  const removed = ids.filter(id => data.removed_comment_ids.includes(id));
  const score = removed.length / ids.length;
  return score;
}
