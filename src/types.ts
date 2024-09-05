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
  /** Ignore actions by these moderators */
  ignoredMods: string;
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
  /** numComments app setting when the current User Score was calculated*/
  numComments_for_score: number,
};

/**
 * Structure for histogram data
 */
export type Histogram = {
  /** Total number of users tracked by User Scorer */
  count: number,
  /** Total number of users with assigned User Scores */
  count_scored: number,
  /** Array of histogram bins */
  bins: {
    /** Formatted bin label for printing */
    label: string,
    /** Frequency count of the bin */
    count: number,
  }[],
  /** Flag indicating whether the full data was processed */
  is_complete: boolean,
  /** Mean value of scored users */
  mean: number,
  /** Median value of scored users */
  median: number,
}
