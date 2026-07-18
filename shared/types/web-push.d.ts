declare module 'web-push' {
  interface SendNotificationOptions {
    TTL?: number
    urgency?: string
    headers?: Record<string, string>
  }

  interface PushSubscription {
    endpoint: string
    keys?: {
      auth?: string
      p256dh?: string
    }
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function sendNotification(subscription: PushSubscription, payload: string, options?: SendNotificationOptions): Promise<{ statusCode: number }>
}
