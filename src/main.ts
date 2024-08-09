import { Devvit } from '@devvit/public-api';
import { generateReport, onCommentSubmit, onModAction, onDelayedModAction, showUserScore } from './handlers.js';
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

// Delayed ModAction processing for tracking comment removal status
Devvit.addSchedulerJob({
  name: "delayedModAction",
  onRun: onDelayedModAction,
});

// Show current User Score for target author
Devvit.addMenuItem({
  label: 'Get User Score',
  location: 'comment',
  forUserType: 'moderator',
  onPress: showUserScore,
});

// Generate report delivered via Modmail
Devvit.addMenuItem({
  label: 'User Scorer Report',
  description: 'Generate a summary of User Scorer metrics, delivered via Modmail',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: generateReport,
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
    for (let i = 0; i < 10000; i++) {
      await context.redis.zAdd("#users", { member: `TestUser_${i}`, score: Math.random() });
    }
    console.log(`Added test users`);
  },
});

Devvit.addMenuItem({
  label: 'Remove Test Users',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    for (let i = 0; i < 10000; i++) {
      await context.redis.zRem("#users", [`TestUser_${i}`]);
    }
    console.log(`Removed test users`);
  },
});

export default Devvit;
