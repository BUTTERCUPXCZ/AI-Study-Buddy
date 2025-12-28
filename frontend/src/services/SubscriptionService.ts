import { api } from '@/lib/api';

export interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  periodEnd: string | null;
  attemptsUsed: number;
  attemptsLimit: number | null;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

 class SubscriptionService {
  /**
   * Create checkout session and redirect to Stripe
   */
  async createCheckoutSession(): Promise<void> {
    const baseUrl = window.location.origin;
    const response = await api.post<CheckoutSession>('/subscriptions/checkout', {
      baseUrl,
    });

    // Redirect to Stripe Checkout using the URL from the backend
    window.location.href = response.data.url;
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await api.get<SubscriptionStatus>('/subscriptions/status');
    return response.data;
  }

  /**
   * Verify a Checkout session and apply subscription if payment succeeded.
   * This is a fallback for cases where the webhook delivery is delayed or missed.
   */
  async verifySession(sessionId: string): Promise<{ verified: boolean }> {
    const response = await api.post<{ verified: boolean }>('/subscriptions/verify-session', {
      sessionId,
    });
    return response.data;
  }

  /**
   * Open customer portal for subscription management
   */
  async openCustomerPortal(): Promise<void> {
    const baseUrl = window.location.origin;
    const response = await api.post<{ url: string }>('/subscriptions/portal', {
      baseUrl,
    });


     // Redirect to Stripe Customer Portal
    window.location.href = response.data.url;
}
}

export const subscriptionService = new SubscriptionService();