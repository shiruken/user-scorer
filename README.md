# User Scorer

Automatically report or remove comments from users based on their User Score, a metric quantifying their recent history in your subreddit.

[https://developers.reddit.com/apps/user-scorer](https://developers.reddit.com/apps/user-scorer)

## Features

* Minimal setup requiring *zero* knowledge about AutoModerator or coding
* *Automatically* action (report and/or remove) comments from users based on their recent history in your subreddit (i.e. their [User Score](#user-score))
* Moderator actions *directly impact* User Score

## User Score

This app operates under the premise that frequently-actioned users are likely to have their future content removed. To quantify this dynamic, a user's recent comment history in the subreddit is used to assign a "User Score." This metric is determined by taking the last `N` comments from the user in the subreddit, identifying how many of those comments have been removed (`R`), and calculating the fraction of comments that were removed (`R/N`) as the User Score. Because an established comment history is necessary for this calculation, User Scores are not assigned until at least five comments have been tracked.

![User Score Equation](https://github.com/user-attachments/assets/0664c452-7a97-4b9a-b6b5-350b124d1675)

The User Score metric ranges in value between 0 and 1 (inclusive). A User Score of `0.0` indicates that *no* recent comments by the user have been removed (i.e. a "good" user). A User Score of `1.0` indicates that *all* recent comments by the user have been removed (i.e. a "bad" user). The app installation settings let moderators enable automatic reporting and removal of comments based on User Score and the thresholds at which these actions occur.

![User Score Line Diagram](https://github.com/user-attachments/assets/1ea3bffa-2aef-447f-a764-29890c30f25e)

## Installation Settings

![Screenshot of Installation Settings](https://github.com/user-attachments/assets/8baad9f6-414b-47af-bcd3-18db13f88172)

* **Number of Comments**: The maximum number of recent comments by a user to consider when calculating their User Score
  * Minimum: 5 (User Scores are not assigned until at least five comments have been tracked)
  * Maximum: 1000
* Comment Reporting
  * **Enable Reporting:** Toggle on/off the comment reporting feature
  * **Report Threshold:** Report comments from users with a User Score greater than or equal to this value
    * Minimum: 0.0 (No recent comments from the user have been removed)
    * Maximum: 1.0 (All recent comments from the user have been removed)
    * Should be *less than* the **Remove Threshold**
* Comment Removal
  * **Enable Removal:** Toggle on/off the comment removal feature
  * **Remove Threshold:** Remove comments from users with a User Score greater than or equal to this value
    * Minimum: 0.0 (No recent comments from the user have been removed)
    * Maximum: 1.0 (All recent comments from the user have been removed)
    * Should be *greater than* the **Report Threshold**

### Tips

* Start with *only* Comment Reporting enabled in order to learn what thresholds are appropriate for your subreddit.
* Enable Comment Reporting with a Report Threshold of `0` to get reports on *all* new comments (from users with assigned User Scores).
* The app will still track new comments and calculate User Scores even if both Comment Reporting and Comment Removal are disabled.

## Menu Actions

### Get User Score

This action appears under the moderator menu on comments in the subreddit. It will display the current User Score for the comment's author, if it has been assigned.

![Screenshot of 'Get User Score' Menu Action](https://github.com/user-attachments/assets/d03994e0-4330-489b-b827-fcce742afbb2) ![Screenshot of 'Get User Score' Toasts](https://github.com/user-attachments/assets/c8e5bde1-bf23-41c6-ae0a-4074252133a4)

## Limitations

* The app currently relies upon the *tracking* of comments to establish a user's comment history. This means it is naive to any comments made *prior* to the installation of the app and that it will take some time to gather the minimum number of comments (5) necessary to assign a User Score.
* Uninstalling the app will delete all its data. This includes all tracked users and their respective comment histories. There is currently no way to backup (or restore) this data, so be careful when uninstalling.
* The app can currently only report and/or remove comments. Filtering content directly to the Mod Queue is a feature exclusive to AutoModerator.

## Links

* [Source Code](https://github.com/shiruken/user-scorer/)
* [Changelog](https://github.com/shiruken/user-scorer/releases)
