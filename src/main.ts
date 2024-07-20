import { Devvit } from '@devvit/public-api';
import { onCommentSubmit } from './handlers.js';

Devvit.configure({
  redis: true,
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: onCommentSubmit,
});

Devvit.addMenuItem({
  },
});

export default Devvit;
