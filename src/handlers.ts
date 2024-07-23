import { TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction } from '@devvit/protos';

export async function onCommentSubmit(event: CommentSubmit, context: TriggerContext) {
  const comment = event.comment;
  if (!comment) {
    throw new Error('Missing `comment` in onCommentSubmit');
  }

  const user = event.author;
  if (!user) {
    throw new Error('Missing `user` in onCommentSubmit');
  }

  const data = await context.redis.hgetall(user.name);

  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  let comment_ids: string[] = [];
  let removed_comment_ids: string[] = [];
  if (!data || Object.keys(data).length === 0) { // Initialize Redis hash for user
    await context.redis.hset(user.name, {
      ['id']: user.id,
      ['name']: user.name,
      ['comment_ids']: "[]",
      ['removed_comment_ids']: "[]",
      ['score']: "0",
    });
    console.log(`Initialized Redis hash for u/${user.name}`);
  } else {
    comment_ids = JSON.parse(data.comment_ids);
    removed_comment_ids = JSON.parse(data.removed_comment_ids);
  }
  
  if (comment_ids.includes(comment.id)) {
    console.log(`Skipped ${comment.id} by u/${user.name}, already tracked`);
    return;
  }

  comment_ids.push(comment.id);
  const score = calculateScore(comment_ids, removed_comment_ids);
  await context.redis.hset(user.name, {
    ['comment_ids']: JSON.stringify(comment_ids),
    ['score']: JSON.stringify(score),
  });
  console.log(`u/${user.name}: Added ${comment.id} (comments=${comment_ids.length}, removed=${removed_comment_ids.length}, score=${score})`);

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

  const data = await context.redis.hgetall(user.name);

  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  if (!data || Object.keys(data).length === 0) {
    throw new Error(`Redis hash does not exist for user`);
  }

  const comment_ids: string[] = JSON.parse(data.comment_ids);
  const removed_comment_ids: string[] = JSON.parse(data.removed_comment_ids);

  if (!comment_ids.includes(comment.id)) {
    throw new Error(`${comment.id} missing from comment_ids for u/${user.name}`);
  }

  if (action == "removecomment" || action == "spamcomment") {
    if (!removed_comment_ids.includes(comment.id)) {
      removed_comment_ids.push(comment.id);
      const score = calculateScore(comment_ids, removed_comment_ids);
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(removed_comment_ids),
        ['score']: JSON.stringify(score),
      });
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${comment_ids.length}, removed=${removed_comment_ids.length}, score=${score})`)
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, already tracked`);
    }
  }
  
  if (action == "approvecomment" && removed_comment_ids.includes(comment.id)) {
    if (removed_comment_ids.includes(comment.id)) {
      const index = removed_comment_ids.indexOf(comment.id);
      removed_comment_ids.splice(index, 1);
      const score = calculateScore(comment_ids, removed_comment_ids);
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(removed_comment_ids),
        ['score']: JSON.stringify(score),
      });
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${comment_ids.length}, removed=${removed_comment_ids.length}, score=${score})`)
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, not tracked`);
    }
  }

  const data_updated = await context.redis.hgetall(user.name);
  console.log(`u/${user.name} user data:\n${JSON.stringify(data_updated, null, 2)}`);
}

function calculateScore(comment_ids: string[], removed_comment_ids: string[], limit: number=5): number {
  const comment_ids_slice = comment_ids.slice(-limit);
  const union = comment_ids_slice.filter(id => removed_comment_ids.includes(id));
  const score = union.length / comment_ids_slice.length;
  return score;
}
