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
  /** numComments app setting when the current User Score was calculated*/
  numComments_for_score: number,
};

/**
 * Structure for histogram data
 */
export type Histogram = {
  /** Total number of users tracked by User Scorer */
  count: number,
  /** Array of histogram bins */
  bins: {
    /** 
     * Array defining the lower (exclusive) and upper (inclusive) bounds of the bin.
     * A single element array defines a single-value bin
    */
    range: number[],
    /** Formatted bin label for printing */
    label: string,
    /** Frequency count of the bin */
    count: number,
  }[],
}
