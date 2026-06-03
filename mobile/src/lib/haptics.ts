import * as Haptics from 'expo-haptics';

/** Light tap — primary buttons, tab switch, photo cell press */
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** Medium tap — destructive cancel, sheet dismiss */
export const tapMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/** Success notification — upload complete, milestone created */
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** Warning notification — error alerts */
export const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
