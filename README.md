# User Scorer

Automatically report or remove comments from users based on their User Score, a metric quantifying their recent history in your subreddit.

[https://developers.reddit.com/apps/user-scorer](https://developers.reddit.com/apps/user-scorer)

## Features

* Minimal setup requiring *zero* knowledge about AutoModerator or coding
* *Automatically* action comments from users based on their recent history in your subreddit (i.e. their [User Score](#user-score))
* Moderator actions *directly impact* User Score

## User Score

This app operates under the premise that frequently-actioned users are likely to have their future content removed. To quantify this dynamic, a user's recent comment history in the subreddit is used to assign a "User Score." This metric is determined by taking the last `N` comments from the user in the subreddit, identifying how many of those comments have been removed (`R`), and calculating the fraction of comments that were removed (`R/N`) as the User Score. Because an established comment history is necessary for this calculation, User Scores are not assigned until at least five comments have been tracked. Deleted comments *are* accounted for in this calculation, so users cannot purge their comments to avoid accountability.

![User Score Equation](https://github.com/user-attachments/assets/0664c452-7a97-4b9a-b6b5-350b124d1675)

The User Score metric ranges in value between 0 and 1 (inclusive). A User Score of `0.0` indicates that *no* recent comments by the user have been removed (i.e. a "good" user). A User Score of `1.0` indicates that *all* recent comments by the user have been removed (i.e. a "bad" user). The app installation settings let moderators enable automatic reporting and removal of comments based on User Score and the thresholds at which these actions occur.

![User Score Line Diagram](https://github.com/user-attachments/assets/1ea3bffa-2aef-447f-a764-29890c30f25e)

*Note: User Score is an **unofficial** metric created solely for this app and has no connection to official Reddit moderation metrics.*

## Installation Settings

![Screenshot of Installation Settings](https://github.com/user-attachments/assets/c5711a8c-49fc-4e6c-862e-15ba4f97dfb3)

* **Number of Comments:** The maximum number of recent comments by a user to consider when calculating their User Score
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
* **Ignored Moderators:** Actions by these moderators are ignored and do not contribute to User Score
  * Enter as a comma-separated list (e.g. `AutoModerator, comment-nuke`)
  * **Warning:** Ignoring actions by certain moderators complicates the interpretation of the User Score metric. It will no longer represent a _complete_ removed comment history for a user since certain removals will have been excluded from tracking. This may lead to inconsistencies between the numbers reported by User Scorer and the Moderation Log entries for the user.
  * This setting _does not_ retroactively modify existing User Scores and only applies to future moderator actions.

### Tips

* Start with *only* Comment Reporting enabled in order to learn what thresholds are appropriate for your subreddit.
* Use a Report Threshold of `0` to get reports on *all* new comments (from users with assigned User Scores).
* Comments will still be tracked even if both Comment Reporting and Comment Removal are disabled.

## Moderation Actions

### Comment Reporting

![Screenshot of Reported Comment](https://github.com/user-attachments/assets/07673cd1-49da-4a9f-9c0f-597b26c47ee3)

_Note: If any moderators are ignored in the installation settings, an asterisk will be appended to the removed comment count_

### Comment Removal

![Screenshot of Removed Comment](https://github.com/user-attachments/assets/d3961e96-9ed6-4d3c-9737-05926c2b7a4b)

![Screenshot of Mod Log Entry](https://github.com/user-attachments/assets/9db26275-bf32-4675-ac68-5073bb093b52)

## Menu Actions

### Get User Score

This action appears under the moderator menu on comments in the subreddit. It displays the current User Score for the comment's author (if it has been assigned).

![Screenshot of 'Get User Score' Menu Action](https://github.com/user-attachments/assets/d03994e0-4330-489b-b827-fcce742afbb2) ![Screenshot of 'Get User Score' Toasts](https://github.com/user-attachments/assets/c8e5bde1-bf23-41c6-ae0a-4074252133a4)

_Note: If any moderators are ignored in the installation settings, an asterisk will be appended to the removed comment count_

### User Scorer Report

This action appears under the moderator menu for the subreddit. It generates a report summarizing the current User Scorer metrics, delivered via Modmail. Statistics are calculated *excluding* 0.0 scores since the majority of scored users will have no removed comments.

![Screenshot of 'User Scorer Report' Menu Action](https://github.com/user-attachments/assets/28a6e3b4-3293-4331-a5bc-01997df3874b) ![Screenshot of 'User Scorer Report' Modmail Message](https://github.com/user-attachments/assets/03d6df02-aeca-4a25-91ed-09bfa1261861)

## Limitations

* The app currently relies upon the *tracking* of comments to establish a user's comment history (necessary to handle deletions). This means it is naive to any comments made *prior* to the installation of the app and that it will take some time to gather the minimum number of comments (5) necessary to assign a User Score.
* Uninstalling the app will delete all its data. This includes all tracked users and their respective comment histories. There is currently no way to backup (or restore) this data, so be careful when uninstalling.
* The app can currently only report and/or remove comments. Filtering content directly to the Mod Queue is a feature exclusive to AutoModerator.

## Changelog

*[View Releases on GitHub](https://github.com/shiruken/user-scorer/releases)*

* v1.3
  * Modmail notifications are now routed into the Inbox rather than Mod Discussions
  * Added setting to ignore actions by specified moderators
* v1.2
  * Subreddit moderator menu action to generate summary report
  * Improved displayed messages
* v1.1
  * Improved data initialization and processing
  * Ignore deleted accounts
* v1.0
  * Initial Release

## Links

* [Source Code](https://github.com/shiruken/user-scorer/)
