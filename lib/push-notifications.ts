import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "./prisma";

type PostType = "recipe" | "basic" | "meal_plan";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

const POST_TYPE_LABELS: Record<PostType, string> = {
  recipe: "recipe",
  basic: "basic",
  meal_plan: "meal plan",
};

const NOTIFICATION_SOUND = "default";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

function sanitizeBody(body: string, maxLength = 140) {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength - 1).trimEnd() + "…";
}

async function getActorName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, friendCode: true, email: true },
  });

  return (
    user?.displayName ??
    user?.friendCode ??
    user?.email ??
    "Someone"
  );
}

export async function saveExpoToken(
  userId: string,
  token: string,
  meta?: {
    platform?: string;
    deviceId?: string;
  }
) {
  if (!Expo.isExpoPushToken(token)) {
    throw new Error("Invalid Expo push token");
  }

  await prisma.pushToken.upsert({
    where: { token },
    update: {
      userId,
      platform: meta?.platform,
      deviceId: meta?.deviceId,
      enabled: true,
    },
    create: {
      userId,
      token,
      platform: meta?.platform,
      deviceId: meta?.deviceId,
    },
  });
}

export async function disablePushTokens(tokens: string[]) {
  if (!tokens.length) return;

  await prisma.pushToken.updateMany({
    where: { token: { in: tokens } },
    data: { enabled: false },
  });
}

export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload
) {
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId, enabled: true },
    });

    const validTokens = tokens
      .filter((token) => Expo.isExpoPushToken(token.token))
      .map((token) => token.token);

    if (!validTokens.length) {
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: NOTIFICATION_SOUND,
      title: payload.title,
      body: sanitizeBody(payload.body),
      data: payload.data ?? {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket: ExpoPushTicket, index: number) => {
          if (
            ticket.status === "error" &&
            ticket.details?.error === "DeviceNotRegistered"
          ) {
            invalidTokens.push(chunk[index]?.to as string);
          }
        });
      } catch (error) {
        console.error("Failed to send push notification chunk", error);
      }
    }

    if (invalidTokens.length) {
      await disablePushTokens(invalidTokens);
    }
  } catch (error) {
    console.error("sendPushToUser error", error);
  }
}

export async function notifyPostOwnerAboutLike(params: {
  actorId: string;
  ownerId: string;
  postType: PostType;
  postId: string;
}) {
  if (params.actorId === params.ownerId) return;

  const actorName = await getActorName(params.actorId);
  const postLabel = POST_TYPE_LABELS[params.postType];

  await sendPushToUser(params.ownerId, {
    title: "New like on your post",
    body: `${actorName} liked your ${postLabel} post.`,
    data: {
      type: "like",
      postType: params.postType,
      postId: params.postId,
      actorId: params.actorId,
    },
  });
}

export async function notifyPostOwnerAboutComment(params: {
  actorId: string;
  ownerId: string;
  postType: PostType;
  postId: string;
  text?: string;
}) {
  if (params.actorId === params.ownerId) return;

  const actorName = await getActorName(params.actorId);
  const postLabel = POST_TYPE_LABELS[params.postType];
  const body = params.text
    ? `${actorName} commented on your ${postLabel} post: "${sanitizeBody(
        params.text,
        100
      )}"`
    : `${actorName} commented on your ${postLabel} post.`;

  await sendPushToUser(params.ownerId, {
    title: "New comment on your post",
    body,
    data: {
      type: "comment",
      postType: params.postType,
      postId: params.postId,
      actorId: params.actorId,
    },
  });
}

