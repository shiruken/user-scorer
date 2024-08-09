/**
 * Maximum number of items to track
 */
export const MAX_ITEMS: number = 1000;

/**
 * Minimum number of tracked comments necessary to start calculating User Scores
 */
export const MIN_NUM_COMMENTS: number = 5;

/**
 * Placeholder value for unassigned User Scores
 */
export const SCORE_PLACEHOLDER: number = -1;

/**
 * Key for Redis Sorted Set of all tracked users
 */
export const USERS_KEY = "#users";

/**
 * Amount of time (in seconds) to delay processing automated ModActions
 */
export const DELAY_MODACTION_BY = 5;

/**
 * Maximum bar length for histogram in reports
 */
export const HISTOGRAM_MAX_BAR_LENGTH = 30;
