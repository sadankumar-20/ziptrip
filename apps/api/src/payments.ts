/**
 * Razorpay integration, off by default (PAYMENTS_ENABLED=false).
 * Flow: client asks the API for an order → Razorpay Checkout runs in the browser → the browser posts the
 * payment ids and signature back → the API verifies the HMAC with the secret key (never sent to the browser).
 * The webhook is the backstop if the browser closes before verification.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from './env';

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyPaymentSignature(env: Env, orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

export function verifyWebhookSignature(env: Env, rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

export async function createRazorpayOrder(env: Env, amountInr: number, receipt: string): Promise<{ id: string; amount: number; currency: string }> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountInr * 100, currency: 'INR', receipt, notes: { booking_ref: receipt } }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status})`);
  return (await res.json()) as { id: string; amount: number; currency: string };
}
