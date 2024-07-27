import { Devvit } from '@devvit/public-api';
import { onCommentSubmit, onModAction } from './handlers.js';
import { getAppSettings, settings } from './settings.js';

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
  label: 'Get Settings',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async(_event, context) => {
    const settings = await getAppSettings(context.settings);
    console.log(settings);
  },
});

export default Devvit;
