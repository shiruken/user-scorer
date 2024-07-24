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

  // Action comment, if enabled and eligible
  if (data.comment_ids.length >= 5) {
    if (data.score >= 0.4) {
      const object = await context.reddit.getCommentById(comment.id);
      const score_fmt = data.score.toLocaleString("en-US", { maximumFractionDigits: 3 });

      // Report
      if (data.score >= 0.4) {
        await context.reddit
          .report(object, { reason: `Bad User Score (${score_fmt})` })
          .then(() => console.log(`u/${user.name}: Reported ${comment.id} (score=${data.score})`) )
          .catch((e) => console.error(`u/${user.name}: Error reporting ${object.id}`, e));
      }

      // Remove
      if (data.score >= 0.6) {
        await object
          .remove()
          .then(() => console.log(`u/${user.name}: Removed ${comment.id} (score=${data.score})`) )
          .catch((e) => console.error(`u/${user.name}: Error removing ${object.id}`, e));
      }
    }
  } else {
    console.log(`u/${user.name}: Insufficient history to action ${comment.id} (comments=${data.comment_ids.length})`);
  }

  data.comment_ids.push(comment.id);
  data.score = calculateScore(data, 10);
  await context.redis.hset(user.name, {
    ['comment_ids']: JSON.stringify(data.comment_ids),
    ['score']: JSON.stringify(data.score),
  });
  console.log(`u/${user.name}: Added ${comment.id} ` +
              `(comments=${data.comment_ids.length}, ` +
              `removed=${data.removed_comment_ids.length}, ` +
              `score=${data.score})`);
}

export async function onModAction(event: ModAction, context: TriggerContext) {
  const action = event.action;
  if (!action) {
    throw new Error('Missing `action` in onModAction');
  }

  if (action != "removecomment" && action != "spamcomment" && action != "approvecomment") {
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
      data.score = calculateScore(data, 10);
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
      data.score = calculateScore(data, 10);
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

  // Initialize Redis hash for new user
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

/**
 * Calculate the User Score for a user based on their recent comments
 * 
 * User Score = Fraction of recent comments that have been removed.
 * Possible values range between [0, 1]. A minimum of 5 tracked
 * comments are necessary to assign a non-zero score.
 * @param data {@link UserData} for the target user
 * @param num_comments Number of recent comments to use for calculating the User Score
 * @returns A User Score
 */
function calculateScore(data: UserData, n_comments: number): number {
  if (data.comment_ids.length < 5) {
    return 0;
  }
  const ids = data.comment_ids.slice(-n_comments);
  const removed = ids.filter(id => data.removed_comment_ids.includes(id));
  const score = removed.length / ids.length;
  return score;
}
