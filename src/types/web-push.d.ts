// Hand-written types for web-push 4.0.0 (ESM, named exports only — there is no default export).
// @types/web-push targets 3.x and is deliberately NOT installed (blueprint §11, decision log #12).
// Declares only what HomeBoard uses; extend it here if a new export is needed.
declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  export type VapidKeys = { publicKey: string; privateKey: string };

  export type SendResult = {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };

  export type RequestOptions = {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  };

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | null,
    options?: RequestOptions,
  ): Promise<SendResult>;

  export function generateVAPIDKeys(): VapidKeys;

  export class WebPushError extends Error {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
    endpoint: string;
  }
}
