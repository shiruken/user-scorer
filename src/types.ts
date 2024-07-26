/**
 * App installation settings
 */
export type AppSettings = {
  /** Number of recent comments to consider during scoring */
  numComments: number;
  /** Enable reporting of comments that exceed Report Threshold */
  reportComments: boolean;
  /** Report comments with User Score greater than or equal to this value */
  reportThreshold: number;
  /** Enable removing of comments that exceed Remove Threshold */
  removeComments: boolean;
  /** Remove comments with User Score greater than or equal to this value */
  removeThreshold: number;
};

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
