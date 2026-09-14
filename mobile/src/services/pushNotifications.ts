import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushDevice } from "../api";

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Njoftimet Parko",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.easProjectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await registerPushDevice(token, Platform.OS);
  return token;
}
