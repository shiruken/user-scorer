import { Devvit } from '@devvit/public-api';
import { onCommentSubmit, onModAction } from './handlers.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: onCommentSubmit,
});

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
    console.log(users);
  },
});

export default Devvit;
