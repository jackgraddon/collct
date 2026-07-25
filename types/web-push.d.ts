declare module 'web-push' {
  interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  interface SendNotificationOptions {
    TTL?: number
    urgency?: string
    topic?: string
  }

  function generateVAPIDKeys(): VapidKeys
  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function sendNotification(
    subscription: { endpoint: string; keys?: { auth: string; p256dh: string } },
    payload: string,
    options?: SendNotificationOptions,
  ): Promise<void>

  export { generateVAPIDKeys, setVapidDetails, sendNotification }
}
