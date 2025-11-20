## Expo push registration

Add the following helper inside your Expo-managed mobile app to request permissions, retrieve an Expo push token, and register it with the web API you just added.

```tsx
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react";

export async function registerForPushNotifications(authToken: string) {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permissions not granted");
    return null;
  }

  const projectId = "<your-eas-project-id>";
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;

  await fetch("https://your-domain.com/api/notifications/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      token: expoPushToken,
      platform: Platform.OS,
      deviceId: Device.osBuildId ?? Device.modelId ?? undefined,
    }),
  });

  return expoPushToken;
}
```

Call `registerForPushNotifications` after sign-in so the user’s device token is kept in sync with the backend. Pass the BetterAuth session token (or reuse the cookie-backed auth flow if your mobile app shares sessions with the web client).

