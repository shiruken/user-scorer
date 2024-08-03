import { MIN_NUM_COMMENTS, SCORE_PLACEHOLDER } from "./constants.js";
import { UserData } from "./types.js";

/**
 * Calculate the User Score for a user based on their recent comments
 * 
 * User Score = Fraction of recent comments that have been removed.
 * Possible values range between [0, 1]. A minimum of five tracked
 * comments are necessary to assign a non-placeholder value.
 * @param data {@link UserData} for the target user
 * @param num_comments Number of recent comments to use for calculating the User Score
 * @returns A User Score
 */
export function calculateScore(data: UserData, n_comments: number): number {
  if (data.comment_ids.length < MIN_NUM_COMMENTS) {
    return SCORE_PLACEHOLDER;
  }
  const ids = data.comment_ids.slice(-n_comments);
  const removed = ids.filter(id => data.removed_comment_ids.includes(id));
  const score = removed.length / ids.length;
  return score;
}
