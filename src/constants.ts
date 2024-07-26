/**
 * Maximum number of items to track
 */
export const MAX_ITEMS: number = 1000;

/**
 * Minimum number of tracked comments necessary to start calculating User Scores
 */
export const MIN_NUM_COMMENTS: number = 5;

/**
 * Key for Redis Sorted Set of all tracked users
 */
export const USERS_KEY = "#users";
