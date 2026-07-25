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

  export function generateVAPIDKeys(): VapidKeys
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(
    subscription: { endpoint: string; keys?: { auth: string; p256dh: string } },
    payload: string,
    options?: SendNotificationOptions,
  ): Promise<void>

  const webpush: {
    generateVAPIDKeys(): VapidKeys
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(
      subscription: { endpoint: string; keys?: { auth: string; p256dh: string } },
      payload: string,
      options?: SendNotificationOptions,
    ): Promise<void>
  }

  export default webpush
}
