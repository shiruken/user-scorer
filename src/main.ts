import { Devvit } from '@devvit/public-api';
import { onCommentSubmit, showUserScore, onModAction, onDelayedModAction } from './handlers.js';
import { settings } from './settings.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addSettings(settings);

// Track and action new comments
Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: onCommentSubmit,
});

// Track comment removal status
Devvit.addTrigger({
  event: 'ModAction',
  onEvent: onModAction,
});

// Show current User Score for target author
Devvit.addMenuItem({
  label: 'Get User Score',
  location: 'comment',
  forUserType: 'moderator',
  onPress: showUserScore,
});

// Delayed ModAction processing for tracking comment removal status
Devvit.addSchedulerJob({
  name: "delayedModAction",
  onRun: onDelayedModAction,
});

Devvit.addMenuItem({
  label: 'Clear User Score for u/shiruken',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    await context.redis.del("shiruken");
    await context.redis.zRem("#users", ["shiruken"]);
    console.log("Deleted u/shiruken from Redis");
  },
});

Devvit.addMenuItem({
  label: 'Get Tracked Users',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    const users = await context.redis.zRange("#users", 0, -1);
    console.log(`\n#users: ${JSON.stringify(users, null, 2)}`);
    const user = await context.redis.hgetall("shiruken");
    console.log(`\nu/shiruken: ${JSON.stringify(user, null, 2)}`);
  },
});

Devvit.addMenuItem({
  label: 'Add Test Users',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    await context.redis.zAdd("#users", { member: "A", score: -1 });
    await context.redis.zAdd("#users", { member: "B", score: 0 });
    await context.redis.zAdd("#users", { member: "C", score: 0.1 });
    await context.redis.zAdd("#users", { member: "D", score: 0.2 });
    await context.redis.zAdd("#users", { member: "E", score: 0.3 });
    await context.redis.zAdd("#users", { member: "F", score: 0.4 });
    await context.redis.zAdd("#users", { member: "G", score: 0.5 });
    await context.redis.zAdd("#users", { member: "H", score: 0.6 });
    await context.redis.zAdd("#users", { member: "I", score: 0.7 });
    await context.redis.zAdd("#users", { member: "J", score: 0.8 });
    await context.redis.zAdd("#users", { member: "K", score: 0.9 });
    await context.redis.zAdd("#users", { member: "L", score: 1.0 });
    await context.redis.zAdd("#users", { member: "M", score: 0.05 });
    await context.redis.zAdd("#users", { member: "N", score: 0.15 });
    await context.redis.zAdd("#users", { member: "O", score: 0.25 });
    await context.redis.zAdd("#users", { member: "P", score: 0.35 });
    await context.redis.zAdd("#users", { member: "Q", score: 0.45 });
    await context.redis.zAdd("#users", { member: "R", score: 0.55 });
    await context.redis.zAdd("#users", { member: "S", score: 0.65 });
    await context.redis.zAdd("#users", { member: "T", score: 0.75 });
    await context.redis.zAdd("#users", { member: "U", score: 0.85 });
    await context.redis.zAdd("#users", { member: "V", score: 0.95 });
    await context.redis.zAdd("#users", { member: "W", score: 0.01 });
    await context.redis.zAdd("#users", { member: "X", score: 0.99 });
    await context.redis.zAdd("#users", { member: "Y", score: 0 });
    await context.redis.zAdd("#users", { member: "Z", score: 1.0 });
    console.log("Added test users");
  },
});

Devvit.addMenuItem({
  label: 'Remove Test Users',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    await context.redis.zRem("#users", [
      "A","B","C","D","E","F","G","H","I","J","K","L","M",
      "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    ]);
    console.log("Removed test users");
  },
});

export default Devvit;
