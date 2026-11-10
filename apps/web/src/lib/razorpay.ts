/**
 * Online payment, used only when the API reports paymentsEnabled = true.
 * The browser never sees the Razorpay secret: the API creates the order and verifies the signature.
 */
import { API_URL } from './config';

declare global { interface Window { Razorpay?: any } }

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window'));
    document.head.appendChild(s);
  });
}

export async function payWithRazorpay(ref: string, phone: string): Promise<'paid' | 'dismissed'> {
  const res = await fetch(`${API_URL}/api/payments/razorpay/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, phone }) });
  const order = await res.json();
  if (!res.ok) throw new Error(order.error ?? 'Could not start the payment');
  await loadCheckout();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'JoinZipTrip',
      description: `Booking ${order.ref}`,
      prefill: { name: order.name, email: order.email, contact: `+91${order.phone}` },
      theme: { color: '#103D2B' },
      handler: async (r: Record<string, string>) => {
        const v = await fetch(`${API_URL}/api/payments/razorpay/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
        if (v.ok) resolve('paid');
        else reject(new Error('Payment received but not verified yet. We will confirm on WhatsApp.'));
      },
      modal: { ondismiss: () => resolve('dismissed') },
    });
    rzp.open();
  });
}
