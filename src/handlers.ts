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
  console.log(`u/${user.name} user data:\n${JSON.stringify(data, null, 2)}`);

  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  let comment_ids: string[] = [];
  if (!data || Object.keys(data).length === 0) { // Initialize Redis hash for user
    await context.redis.hset(user.name, {
      ['id']: user.id,
      ['name']: user.name,
      ['comment_ids']: "[]",
      ['removed_comment_ids']: "[]",
    });
    console.log(`Initialized Redis hash for u/${user.name}`);
  } else {
    comment_ids = JSON.parse(data.comment_ids);
  }
  
  if (comment_ids.includes(comment.id)) {
    console.log(`Skipped ${comment.id} by u/${user.name}, already in comment_ids`);
    return;
  }

  comment_ids.push(comment.id);
  await context.redis.hset(user.name, { ['comment_ids']: JSON.stringify(comment_ids) });
  console.log(`Added ${comment.id} to u/${user.name} (${comment_ids.length} items in comment_ids)`);
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
  console.log(`u/${user.name} user data:\n${JSON.stringify(data, null, 2)}`);

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
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(removed_comment_ids)
      });
      console.log(`Added ${comment.id} to u/${user.name} on ${action} (${removed_comment_ids.length} items in removed_comment_ids)`);
    } else {
      console.log(`Skipped ${comment.id} by u/${user.name} on ${action}, already in removed_comment_ids`);
    }
  }
  
  if (action == "approvecomment" && removed_comment_ids.includes(comment.id)) {
    if (removed_comment_ids.includes(comment.id)) {
      const index = removed_comment_ids.indexOf(comment.id);
      removed_comment_ids.splice(index, 1);
      await context.redis.hset(user.name, {
        ['removed_comment_ids']: JSON.stringify(removed_comment_ids)
      });
      console.log(`Removed ${comment.id} from u/${user.name} on ${action} (${removed_comment_ids.length} items in removed_comment_ids)`);
    } else {
      console.log(`Skipped ${comment.id} by u/${user.name} on ${action}, not in removed_comment_ids`);
    }
  }

}
