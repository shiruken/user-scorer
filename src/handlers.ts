import { TriggerContext } from "@devvit/public-api";
import { CommentSubmit } from '@devvit/protos';

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
  // console.log(`u/${user.name} user data:\n${JSON.stringify(data, null, 2)}`);

  // hgetall is currently returning an empty object instead 
  // of `undefined` when the key does not exist
  let comment_ids: string[] = [];
  if (!data || Object.keys(data).length === 0) { // Initialize Redis hash for user
    await context.redis.hset(user.name, { ['id']: user.id, ['name']: user.name });
    console.log(`Initialized Redis hash for u/${user.name}`);
  } else {
    comment_ids = JSON.parse(data.comment_ids);
  }
  
  if (comment_ids.includes(comment.id)) {
    console.log(`Skipped ${comment.id} by u/${user.name}, already tracked`);
    return;
  }

  comment_ids.push(comment.id);
  await context.redis.hset(user.name, { ['comment_ids']: JSON.stringify(comment_ids) });
  console.log(`Added ${comment.id} to u/${user.name}. ${comment_ids.length} comments tracked.`);
}
