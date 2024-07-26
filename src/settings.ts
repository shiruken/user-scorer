import { SettingsClient, SettingsFormField, SettingsFormFieldValidatorEvent } from '@devvit/public-api';
import { MAX_ITEMS, MIN_NUM_COMMENTS } from './constants.js';
import { AppSettings } from './types.js';

export const settings: SettingsFormField[] = [
  {
    type: "number",
    name: "numComments",
    label: "Number of Comments",
    helpText: `How many recent comments to consider when calculating User Score ` +
              `(Minimum: ${MIN_NUM_COMMENTS}, Maximum: ${MAX_ITEMS})`,
    defaultValue: 10,
    onValidate: validateNumComments,
  },
  {
    type: 'group',
    label: 'Comment Reporting',
    fields: [
      {
        type: 'boolean',
        name: 'reportComments',
        label: 'Enable Reporting',
        defaultValue: true,
      },
      {
        type: "number",
        name: "reportThreshold",
        label: "Report Threshold [0-1]",
        helpText: `Report comments from users with a User Score greater than or equal ` +
                  `to this value (Should be less than the Remove Threshold)`,
        defaultValue: 0.4,
        onValidate: validateThreshold,
      },
    ],
  },
  {
    type: 'group',
    label: 'Comment Removal',
    fields: [
      {
        type: 'boolean',
        name: 'removeComments',
        label: 'Enable Removal',
        defaultValue: false,
      },
      {
        type: "number",
        name: "removeThreshold",
        label: "Remove Threshold [0-1]",
        helpText: `Remove comments from users with a User Score greater than or equal ` +
                  `to this value (Should be greater than the Report Threshold)`,
        defaultValue: 0.6,
        onValidate: validateThreshold,
      },
    ]
  },
];

/**
 * Validates number of comments value from app configuration
 * @param event A SettingsFormFieldValidatorEvent object
 * @returns Returns a string containing an error message if invalid
 */
function validateNumComments(event: SettingsFormFieldValidatorEvent<number>): void | string {
  // Settings fields of type `number` currently force a value of 0 when no value
  // is submitted. This makes it impossible to check for empty fields. 
  if (event.value === undefined) {
    return "Required";
  }
  if (!Number.isInteger(event.value)) {
    return `Must be a positive integer greater than or equal to ${MIN_NUM_COMMENTS}`;
  }
  if (event.value < MIN_NUM_COMMENTS) {
    return `Must be greater than or equal to ${MIN_NUM_COMMENTS}`;
  }
  if (event.value > MAX_ITEMS) {
    return `Must be less than or equal to ${MAX_ITEMS}`;
  }
}

/**
 * Validates report and remove threshold values from app configuration
 * @param event A SettingsFormFieldValidatorEvent object
 * @returns Returns a string containing an error message if invalid
 */
function validateThreshold(event: SettingsFormFieldValidatorEvent<number>): void | string {
  // Settings fields of type `number` currently force a value of 0 when no value
  // is submitted. This makes it impossible to check for empty fields and means
  // that the threshold will be set to 0 even if the user did not mean to do so.
  if (event.value === undefined) {
    return "Required. Use toggle above to disable.";
  }
  if (event.value < 0) {
    return "Must be greater than or equal to 0";
  }
  if (event.value > 1) {
    return "Must be less than or equal to 1";
  }
}

/**
 * Read current app installation settings 
 * @param settings A SettingsClient object
 * @returns A Promise that resolves to a {@link AppSettings} object
 */
export async function getAppSettings(settings: SettingsClient): Promise<AppSettings> {
  const app_settings = await settings.getAll() as AppSettings;
  return app_settings;
}
