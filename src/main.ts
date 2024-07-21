import { Devvit } from '@devvit/public-api';
import { onCommentSubmit, onModAction } from './handlers.js';

Devvit.configure({
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
    context.redis.del("shiruken");
    console.log("Deleted u/shiruken from Redis");
  },
});

export default Devvit;
