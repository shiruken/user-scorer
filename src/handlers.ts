import { Context, MenuItemOnPressEvent, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction } from '@devvit/protos';
import { DELAY_MODACTION_BY, HISTOGRAM_MAX_BAR_LENGTH, MIN_NUM_COMMENTS } from "./constants.js";
import { calculateScore } from "./scorer.js";
import { getAppSettings } from "./settings.js";
import { getHistogram, getUserData, initUserData, storeComments, storeRemovedComments, storeScore, trimArray } from "./storage.js";
import { UserData } from "./types.js";

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
          const score_fmt = data.score.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
          const num_recent_comments = Math.min(data.comment_ids.length, settings.numComments);
          const num_recent_removed = num_recent_comments * data.score;
          await context.reddit
            .report(commentAPI, {
              reason: `Bad User Score (${score_fmt}: ${num_recent_removed} ` +
                      `of ${num_recent_comments} recent comments removed)`,
            })
            .then(() => console.info(`u/${user.name}: Reported ${commentAPI.id} (score=${data!.score})`) )
            .catch((e) => console.error(`u/${user.name}: Error reporting ${commentAPI.id}`, e));
        }

        // Remove
        if (settings.removeComments && data.score >= settings.removeThreshold) {
          if (!commentAPI.removed || !commentAPI.spam) {
            await commentAPI
              .remove()
              .then(() => console.info(`u/${user.name}: Removed ${commentAPI.id} (score=${data!.score})`) )
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
  console.info(`u/${user.name}: Added ${comment.id} (comments=${data.comment_ids.length}, ` +
               `removed=${data.removed_comment_ids.length}, score=${data.score})`);
}

/**
 * Check mod action for tracking comment removal status
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

  // Ignore actions targeting AutoModerator, subreddit mod team accounts, or deleted accounts
  if (
    user.name == "AutoModerator" ||
    user.name == `${event.subreddit!.name}-ModTeam` ||
    user.name == "[deleted]"
  ) {
    return;
  }

  let data = await getUserData(user.name, context.redis);

  // If user data doesn't exist or the comment is missing from tracked
  // comments, then delay processing the mod action to allow for comment
  // tracking to complete. This helps address the race condition that 
  // exists between the CommentSubmit and ModAction triggers.
  if (!data || !(data.comment_ids.includes(comment.id))) {
    const moderator = event.moderator;
    if (!moderator) {
      throw new Error(`Missing \`moderator\` in onModAction, unable to delay ` +
                      `processing of ${action} on ${comment.id}`);
    }

    if (moderator.name == "AutoModerator" || moderator.name == "reddit") {
      const now = new Date();
      const delay = new Date(now.getTime() + DELAY_MODACTION_BY * 1000);
      await context.scheduler.runJob({
        name: "delayedModAction",
        runAt: delay,
        data: {
          action: action,
          username: user.name,
          comment_id: comment.id,
        },
      });
      console.log(`u/${user.name}: Delaying processing of ${action} ` +
                  `by ${moderator.name} on ${comment.id}`);
    } else {
      console.error(`u/${user.name}: Skipped ${action} on ${comment.id} ` +
                    `by ${moderator.name}, user or comment not tracked`);
    }
    return;
  }

  await processModAction(data, action, user.name, comment.id, context);
}

/**
 * Process mod action to track comment removal status
 * @param data A {@link UserData} object
 * @param action A ModAction action (removecomment, spamcomment, or approvecomment)
 * @param username A user name
 * @param comment_id A comment id (t1_*)
 * @param context A TriggerContext object
 */
async function processModAction(
  data: UserData | undefined,
  action: string,
  username: string,
  comment_id: string,
  context: TriggerContext
) {

  // `data` is only undefined when called by the `delayedModAction` Scheduler job.
  // Try loading the user data again to see if a related CommentSubmit trigger has
  // been processed. If `data` remains undefined, then the user is not tracked.
  // This can occur if the mod action targeted an older comment that was created
  // prior to installation of this app.
  if (!data) {
    data = await getUserData(username, context.redis);
    if (!data) {
      console.error(`u/${username}: Skipped ${action} on ${comment_id}, ` +
                    `user not tracked after delayed processing`);
      return;
    }
  }

  if (data.comment_ids.length === 0) {
    console.error(`u/${username}: Skipped ${action} on ${comment_id}, no comments tracked`);
    return;
  }

  if (!(data.comment_ids.includes(comment_id))) {
    console.error(`u/${username}: Skipped ${action} on ${comment_id}, missing from tracked comments`);
    return;
  }

  const settings = await getAppSettings(context.settings);

  if (action == "removecomment" || action == "spamcomment") {
    if (!data.removed_comment_ids.includes(comment_id)) {
      data.removed_comment_ids.push(comment_id); // Track comment
      data.removed_comment_ids = trimArray(data.removed_comment_ids);
      data.score = calculateScore(data, settings.numComments);
      data.numComments_for_score = settings.numComments;
      await storeRemovedComments(data, context.redis);
      console.info(`u/${username}: ${action} on ${comment_id} (comments=${data.comment_ids.length}, ` +
                   `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${username}: Skipped ${action} on ${comment_id}, already tracked in removed comments`);
    }
  }
  
  if (action == "approvecomment") {
    if (data.removed_comment_ids.includes(comment_id)) {
      const index = data.removed_comment_ids.indexOf(comment_id);
      data.removed_comment_ids.splice(index, 1); // Stop tracking comment
      data.score = calculateScore(data, settings.numComments);
      data.numComments_for_score = settings.numComments;
      await storeRemovedComments(data, context.redis);
      console.info(`u/${username}: ${action} on ${comment_id} (comments=${data.comment_ids.length}, ` +
                   `removed=${data.removed_comment_ids.length}, score=${data.score})`);
    } else {
      console.log(`u/${username}: Skipped ${action} on ${comment_id}, not tracked as removed comment`);
    }
  }
}

/**
 * Relay Scheduler job for delayed mod action processing
 * @param event A ScheduledJobEvent object
 * @param context A Context object (unable to type properly for ScheduledJobHandler)
 */
export async function onDelayedModAction(event: ScheduledJobEvent, context: any) {
  const data = event.data;
  if (!data) {
    throw new Error('Missing `data` in onDelayedModAction');
  }

  if (!(data.action && data.username && data.comment_id)) {
    throw new Error('Improper `data` in onDelayedModAction');
  }

  console.log(`u/${data.username}: Beginning delayed processing of ${data.action} on ${data.comment_id}`);
  await processModAction(undefined, data.action, data.username, data.comment_id, context);
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

  if (!data || data.comment_ids.length == 0) {
    context.ui.showToast("User Score not yet assigned (No tracked comments)");
    console.info(`u/${mod!.username} requested u/${username} (No tracked comments)`);
    return;
  }

  if (data.comment_ids.length < MIN_NUM_COMMENTS) {
    context.ui.showToast(`User Score not yet assigned (Only ${data.comment_ids.length} ` +
                         `tracked comment${data.comment_ids.length > 1 ? 's' : ''})`);
    console.info(`u/${mod!.username} requested u/${username} (Insufficient history, ` +
                 `only ${data.comment_ids.length} tracked comment` +
                 `${data.comment_ids.length > 1 ? 's' : ''})`);
    return;
  }

  // Recalculate score if app settings were changed since last scoring
  const settings = await getAppSettings(context.settings);
  if (settings.numComments != data.numComments_for_score) {
    data.score = calculateScore(data, settings.numComments);
    await storeScore(data, context.redis);
    console.log(`u/${username}: Recalculated score on settings change (score=${data.score})`);
  }

  const score_fmt = data.score.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const num_recent_comments = Math.min(data.comment_ids.length, settings.numComments);
  const num_recent_removed = num_recent_comments * data.score;

  context.ui.showToast(
    `User Score: ${score_fmt} (${num_recent_removed} of ` +
    `${num_recent_comments} recent comments removed)`
  );
  console.info(`u/${mod!.username} requested u/${username} (score=${score_fmt})`);
}

/**
 * Generates a report summarizing all tracked users and sends message
 * to subreddit via Modmail
 * @param _event A MenuItemOnPressEvent object
 * @param context A Context object
 */
export async function generateReport(_event: MenuItemOnPressEvent, context: Context) {
  const currentUser = await context.reddit.getCurrentUser();
  console.log(`u/${currentUser?.username} requested a report`);

  const subreddit = await context.reddit.getCurrentSubreddit();
  const settings = await getAppSettings(context.settings);

  const histogram = await getHistogram(context.redis);

  if (histogram.count == 0) {
    context.ui.showToast("No tracked users!");
    console.error("No tracked users");
    return;
  }

  // Generate the histogram visualization
  const bin_max = Math.max(...histogram.bins.map(bin => bin.count));
  let chart = "";
  if (bin_max > 0) {
    histogram.bins.slice(1).forEach(bin => {
      let bar_length: number;
      if (bin_max <= HISTOGRAM_MAX_BAR_LENGTH) { // 1:1 representation
        bar_length = bin.count;
      } else { // Proportional representation
        bar_length = Math.round(bin.count / bin_max * HISTOGRAM_MAX_BAR_LENGTH);
      }
      chart += `    ${bin.label} |${"*".repeat(bar_length)} (${bin.count})\n`;
    });
  }

  const body =
    `**Overview**\n\n` +
    `* Tracked Users: ${histogram.count}${
      histogram.is_complete ? "" : " (**Warning! Failed to process all users**)"
    }\n` +
    `* Scored Users: ${histogram.count - histogram.bins[0].count}\n` +
    `* Unscored Users: ${histogram.bins[0].count}\n\n` +
    `**User Score Distribution** (Best viewed on desktop)\n\n` +
    `${
      (chart == "") ? "    No scored users\n" : `${chart}\n` +
      `* Mean Score: ${histogram.mean.toLocaleString("en-US", { maximumFractionDigits: 3 })}\n` +
      `* Median Score: ${histogram.median.toLocaleString("en-US", { maximumFractionDigits: 3 })}\n\n`
    }\n` +
    `**Settings** ([Edit](https://developers.reddit.com/r/${subreddit.name}/apps/user-scorer))\n\n` +
    `* Comment Reporting: ${
      settings.reportComments ? `Enabled (${settings.reportThreshold} threshold)` : "Disabled"
    }\n` +
    `* Comment Removal: ${
      settings.removeComments ? `Enabled (${settings.removeThreshold} threshold)` : "Disabled"
    }\n\n` +
    `*Generated by [User Scorer](https://developers.reddit.com/apps/user-scorer). ` +
    `Report requested by u/${currentUser?.username}.*`;

  await context.reddit.modMail
    .createConversation({
      to: "user-scorer",
      subject: "User Scorer Report",
      body: body,
      subredditName: subreddit.name,
    })
    .then(() => {
      console.log("Sent modmail with report");
      context.ui.showToast("Check Modmail for the report!");
    })
    .catch((e) => {
      console.error("Error sending report modmail", e);
      context.ui.showToast("Error generating report!");
    });
}
