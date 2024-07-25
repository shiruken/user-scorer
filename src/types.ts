/**
 * Structure for user data stored in Redis
 */
export type UserData = {
  /** Reddit user thing ID (t2_*) */
  id: string;
  /** Reddit username */
  name: string;
  /** List of Reddit comment IDs (t1_*) */
  comment_ids: string[];
  /** List of removed Reddit comment IDs (t1_*) */
  removed_comment_ids: string[];
  /** Current User Score */
  score: number;
};
