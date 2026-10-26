"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExpoPush = sendExpoPush;
const expo_server_sdk_1 = require("expo-server-sdk");
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
const expo = new expo_server_sdk_1.Expo({ accessToken: env_1.env.EXPO_ACCESS_TOKEN || undefined });
async function sendExpoPush(pushTokens, title, body, data) {
    const validTokens = pushTokens.filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token));
    if (validTokens.length === 0)
        return;
    const messages = validTokens.map((to) => ({
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
        }
        catch (error) {
            logger_1.logger.warn({ error }, 'Failed to deliver Expo push notification chunk');
        }
    }
}
