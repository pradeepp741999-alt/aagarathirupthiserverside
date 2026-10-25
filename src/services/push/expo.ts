import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN || undefined });

export async function sendExpoPush(
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const validTokens = pushTokens.filter((token) => Expo.isExpoPushToken(token));
  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      logger.warn({ error }, 'Failed to deliver Expo push notification chunk');
    }
  }
}
