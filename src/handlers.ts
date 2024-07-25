import { TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction } from '@devvit/protos';
import { calculateScore } from "./scorer.js";
import { getUserData, storeComments, storeRemovedComments } from "./storage.js";

/**
 * Tracks and actions new comments
 * @param event A CommentSubmit trigger object
 * @param context A TriggerContext object
 */
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

      // Report
      if (data.score >= 0.4) {
        const score_fmt = data.score.toLocaleString("en-US", { maximumFractionDigits: 2 });
        const num_recent_comments = Math.min(data.comment_ids.length, 10);
        const num_recent_removed = num_recent_comments * data.score;
        await context.reddit
          .report(object, {
            reason: `Bad User Score (${score_fmt}: ${num_recent_removed} ` +
                    `of ${num_recent_comments} recent comments removed)`,
          })
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
  await storeComments(data, context.redis);
  console.log(`u/${user.name}: Added ${comment.id} (comments=${data.comment_ids.length}, ` +
              `removed=${data.removed_comment_ids.length}, score=${data.score})`);
}

/**
 * Tracks comment removal status
 * @param event A ModAction trigger object
 * @param context A TriggerContext object
 */
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
      storeRemovedComments(data, context.redis);
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, already tracked as removed`);
    }
  }
  
  if (action == "approvecomment" && data.removed_comment_ids.includes(comment.id)) {
    if (data.removed_comment_ids.includes(comment.id)) {
      const index = data.removed_comment_ids.indexOf(comment.id);
      data.removed_comment_ids.splice(index, 1);
      data.score = calculateScore(data, 10);
      storeRemovedComments(data, context.redis);
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, not tracked as removed`);
    }
  }
}
