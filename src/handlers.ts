import { Context, MenuItemOnPressEvent, TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction } from '@devvit/protos';
import { MIN_NUM_COMMENTS } from "./constants.js";
import { calculateScore } from "./scorer.js";
import { getAppSettings } from "./settings.js";
import { getUserData, initUserData, storeComments, storeRemovedComments, trimArray } from "./storage.js";

/**
 * Track and action new comments
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

  // Ignore comments from AutoModerator or subreddit mod team account
  if (user.name == "AutoModerator" || (user.name == `${event.subreddit!.name}-ModTeam`)) {
    return;
  }

  let data = await getUserData(user.name, context.redis);
  if (!data) {
    data = await initUserData(user.name, user.id, context.redis);
  }

  if (data.comment_ids.includes(comment.id)) {
    console.log(`u/${user.name}: Skipped ${comment.id}, already tracked`);
    return;
  }

  const settings = await getAppSettings(context.settings);

  // Action comment, if enabled and eligible
  if (settings.reportComments || settings.removeComments) {
    if (data.comment_ids.length >= MIN_NUM_COMMENTS) {

      // Recalculate score if app settings were changed since last scoring
      if (settings.numComments != data.numComments_for_score) {
        data.score = calculateScore(data, settings.numComments);
        console.log(`u/${user.name}: Recalculated score on settings change (score=${data.score})`);
      }

      if (data.score >= Math.min(settings.reportThreshold, settings.removeThreshold)) {
        const commentAPI = await context.reddit.getCommentById(comment.id);

        // Report
        if (settings.reportComments && data.score >= settings.reportThreshold) {
          const score_fmt = data.score.toLocaleString("en-US", { maximumFractionDigits: 2 });
          const num_recent_comments = Math.min(data.comment_ids.length, settings.numComments);
          const num_recent_removed = num_recent_comments * data.score;
          await context.reddit
            .report(commentAPI, {
              reason: `Bad User Score (${score_fmt}: ${num_recent_removed} ` +
                      `of ${num_recent_comments} recent comments removed)`,
            })
            .then(() => console.log(`u/${user.name}: Reported ${commentAPI.id} (score=${data!.score})`) )
            .catch((e) => console.error(`u/${user.name}: Error reporting ${commentAPI.id}`, e));
        }

        // Remove
        if (settings.removeComments && data.score >= settings.removeThreshold) {
          if (!commentAPI.removed || !commentAPI.spam) {
            await commentAPI
              .remove()
              .then(() => console.log(`u/${user.name}: Removed ${commentAPI.id} (score=${data!.score})`) )
              .catch((e) => console.error(`u/${user.name}: Error removing ${commentAPI.id}`, e));
          } else {
            console.log(`u/${user.name}: ${commentAPI.id} is already removed, skipping`);
          }
        }
      }
    } else {
      console.log(`u/${user.name}: Insufficient history to action ${comment.id} ` +
                  `(comments=${data.comment_ids.length})`);
    }
  } else {
    console.error('No actions are enabled in app Installation Settings');
  }

  data.comment_ids.push(comment.id); // Track comment
  data.comment_ids = trimArray(data.comment_ids);
  data.score = calculateScore(data, settings.numComments);
  data.numComments_for_score = settings.numComments;
  await storeComments(data, context.redis);
  console.log(`u/${user.name}: Added ${comment.id} (comments=${data.comment_ids.length}, ` +
              `removed=${data.removed_comment_ids.length}, score=${data.score})`);
}

/**
 * Track comment removal status
 * @param event A ModAction trigger object
 * @param context A TriggerContext object
 */
export async function onModAction(event: ModAction, context: TriggerContext) {
  const action = event.action;
  if (!action) {
    throw new Error('Missing `action` in onModAction');
  }

  // We only care about comment removals and approvals
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

  // Ignore actions targeting AutoModerator or subreddit mod team account
  if (user.name == "AutoModerator" || (user.name == `${event.subreddit!.name}-ModTeam`)) {
    return;
  }

  let data = await getUserData(user.name, context.redis);
  if (!data) {
    console.error(`u/${user.name}: Skipped ${action} on ${comment.id}, user not tracked`);
    return;
  }

  if (data.comment_ids.length === 0) {
    console.error(`u/${user.name}: Skipped ${action} on ${comment.id}, no comments tracked`);
    return;
  }

  if (!(data.comment_ids.includes(comment.id))) {
    console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, missing from tracked comments`);
    return;
  }

  const settings = await getAppSettings(context.settings);

  if (action == "removecomment" || action == "spamcomment") {
    if (!data.removed_comment_ids.includes(comment.id)) {
      data.removed_comment_ids.push(comment.id); // Track comment
      data.removed_comment_ids = trimArray(data.removed_comment_ids);
      data.score = calculateScore(data, settings.numComments);
      data.numComments_for_score = settings.numComments;
      await storeRemovedComments(data, context.redis);
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, already tracked in removed comments`);
    }
  }
  
  if (action == "approvecomment" && data.removed_comment_ids.includes(comment.id)) {
    if (data.removed_comment_ids.includes(comment.id)) {
      const index = data.removed_comment_ids.indexOf(comment.id);
      data.removed_comment_ids.splice(index, 1); // Stop tracking comment
      data.score = calculateScore(data, settings.numComments);
      data.numComments_for_score = settings.numComments;
      await storeRemovedComments(data, context.redis);
      console.log(`u/${user.name}: ${action} on ${comment.id} (comments=${data.comment_ids.length}, ` +
                  `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${user.name}: Skipped ${action} on ${comment.id}, not tracked as removed comment`);
    }
  }
}

/**
 * Show current User Score for target author
 * @param _event A MenuItemOnPressEvent object
 * @param context A Context object
 */
export async function showUserScore(event: MenuItemOnPressEvent, context: Context) {
  if (!event.targetId || !event.targetId.startsWith("t1_")) {
    throw new Error("Improper `event.targetId` in showUserScore");
  }

  const mod = await context.reddit.getCurrentUser();

  const comment = await context.reddit.getCommentById(event.targetId);
  const username = comment.authorName;

  const data = await getUserData(username, context.redis);

  if (!data || data.comment_ids.length < MIN_NUM_COMMENTS) {
    context.ui.showToast("User Score not yet assigned");
    console.log(`u/${mod!.username} requested u/${username} (Not yet tracked or insufficient history)`);
    return;
  }

  // Recalculate score if app settings were changed since last scoring
  const settings = await getAppSettings(context.settings);
  if (settings.numComments != data.numComments_for_score) {
    data.score = calculateScore(data, settings.numComments);
  }

  const score_fmt = data.score.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const num_recent_comments = Math.min(data.comment_ids.length, settings.numComments);
  const num_recent_removed = num_recent_comments * data.score;

  context.ui.showToast(
    `User Score: ${score_fmt} (${num_recent_removed} of ` +
    `${num_recent_comments} recent comments removed)`
  );
  console.log(`u/${mod!.username} requested u/${username} (score=${score_fmt})`);
}
