// ============================================================================
// Stripe Mock - Complete SDK mock for testing billing flows
// ============================================================================

// ============================================================================
// Types - Mirror Stripe SDK types
// ============================================================================

export type StripePriceId = string;
export type StripeCustomerId = string;
export type StripeSubscriptionId = string;
export type StripeInvoiceId = string;
export type StripePaymentMethodId = string;
export type StripeChargeId = string;

export interface StripePlan {
  id: StripePriceId;
  nickname: string;
  unitAmount: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  productId: string;
  features: string[];
}

export interface StripeCustomer {
  id: StripeCustomerId;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  created: number;
  invoiceSettings?: {
    defaultPaymentMethod?: StripePaymentMethodId;
  };
}

export interface StripeSubscription {
  id: StripeSubscriptionId;
  customer: StripeCustomerId;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  plan: {
    id: StripePriceId;
    nickname: string;
    amount: number;
    interval: string;
  };
  cancelAtPeriodEnd: boolean;
}

export interface StripeInvoice {
  id: StripeInvoiceId;
  customer: StripeCustomerId;
  subscription?: StripeSubscriptionId;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: number;
  periodEnd: number;
  created: number;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

export interface StripePaymentMethod {
  id: StripePaymentMethodId;
  customer: StripeCustomerId;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface StripeCharge {
  id: StripeChargeId;
  customer: StripeCustomerId;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  description?: string;
  receiptUrl?: string;
  created: number;
}

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_PLANS: StripePlan[] = [
  {
    id: 'price_starter_monthly',
    nickname: 'Starter',
    unitAmount: 4900,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_starter',
    features: ['3 social accounts', '100 posts/month', 'Basic analytics', 'Email support'],
  },
  {
    id: 'price_growth_monthly',
    nickname: 'Growth',
    unitAmount: 9900,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_growth',
    features: ['10 social accounts', '500 posts/month', 'Advanced analytics', 'Priority support', 'A/B testing'],
  },
  {
    id: 'price_pro_monthly',
    nickname: 'Pro',
    unitAmount: 19900,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_pro',
    features: ['Unlimited accounts', 'Unlimited posts', 'All analytics', '24/7 support', 'All agents', 'Custom integrations'],
  },
];

// In-memory storage for mock data
const customers = new Map<StripeCustomerId, StripeCustomer>();
const subscriptions = new Map<StripeSubscriptionId, StripeSubscription>();
const invoices = new Map<StripeInvoiceId, StripeInvoice>();
const paymentMethods = new Map<StripePaymentMethodId, StripePaymentMethod>();
const charges = new Map<StripeChargeId, StripeCharge>();

// ID counters for generating unique IDs
let customerIdCounter = 1000;
let subscriptionIdCounter = 2000;
let invoiceIdCounter = 3000;
let paymentMethodIdCounter = 4000;
let chargeIdCounter = 5000;

// ============================================================================
// Mock Stripe Class
// ============================================================================

export class MockStripe {
  // Track all API calls for verification
  apiCalls: string[] = [];

  private logCall(method: string, ...args: unknown[]): void {
    this.apiCalls.push(`${method}(${args.map(a => JSON.stringify(a)).join(', ')})`);
  }

  // ==========================================================================
  // Customers
  // ==========================================================================

  async customersCreate(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<StripeCustomer> {
    this.logCall('customers.create', params);
    
    const customer: StripeCustomer = {
      id: `cus_${customerIdCounter++}`,
      email: params.email,
      name: params.name,
      metadata: params.metadata,
      created: Math.floor(Date.now() / 1000),
    };
    
    customers.set(customer.id, customer);
    return customer;
  }

  async customersRetrieve(id: StripeCustomerId): Promise<StripeCustomer | null> {
    this.logCall('customers.retrieve', id);
    return customers.get(id) || null;
  }

  async customersUpdate(
    id: StripeCustomerId,
    params: Partial<StripeCustomer>
  ): Promise<StripeCustomer> {
    this.logCall('customers.update', id, params);
    
    const customer = customers.get(id);
    if (!customer) throw new Error(`Customer not found: ${id}`);
    
    const updated = { ...customer, ...params };
    customers.set(id, updated);
    return updated;
  }

  async customersDelete(id: StripeCustomerId): Promise<{ deleted: boolean; id: string }> {
    this.logCall('customers.delete', id);
    customers.delete(id);
    return { deleted: true, id };
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  async subscriptionsCreate(params: {
    customer: StripeCustomerId;
    items: { price: StripePriceId }[];
    trialDays?: number;
  }): Promise<StripeSubscription> {
    this.logCall('subscriptions.create', params);
    
    const plan = MOCK_PLANS.find(p => p.id === params.items[0]?.price);
    if (!plan) throw new Error(`Price not found: ${params.items[0]?.price}`);
    
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + (plan.interval === 'month' ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60);
    
    const subscription: StripeSubscription = {
      id: `sub_${subscriptionIdCounter++}`,
      customer: params.customer,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      plan: {
        id: plan.id,
        nickname: plan.nickname,
        amount: plan.unitAmount,
        interval: plan.interval,
      },
      cancelAtPeriodEnd: false,
    };
    
    subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async subscriptionsRetrieve(id: StripeSubscriptionId): Promise<StripeSubscription | null> {
    this.logCall('subscriptions.retrieve', id);
    return subscriptions.get(id) || null;
  }

  async subscriptionsUpdate(
    id: StripeSubscriptionId,
    params: Partial<StripeSubscription>
  ): Promise<StripeSubscription> {
    this.logCall('subscriptions.update', id, params);
    
    const subscription = subscriptions.get(id);
    if (!subscription) throw new Error(`Subscription not found: ${id}`);
    
    const updated = { ...subscription, ...params };
    subscriptions.set(id, updated);
    return updated;
  }

  async subscriptionsCancel(id: StripeSubscriptionId): Promise<StripeSubscription> {
    this.logCall('subscriptions.cancel', id);
    
    const subscription = subscriptions.get(id);
    if (!subscription) throw new Error(`Subscription not found: ${id}`);
    
    subscription.cancelAtPeriodEnd = true;
    subscriptions.set(id, subscription);
    return subscription;
  }

  async subscriptionsList(params: {
    customer: StripeCustomerId;
    status?: string;
  }): Promise<StripeSubscription[]> {
    this.logCall('subscriptions.list', params);
    
    return Array.from(subscriptions.values()).filter(
      sub => sub.customer === params.customer &&
        (!params.status || sub.status === params.status)
    );
  }

  // ==========================================================================
  // Invoices
  // ==========================================================================

  async invoicesCreate(params: {
    customer: StripeCustomerId;
    subscription?: StripeSubscriptionId;
    daysUntilDue?: number;
  }): Promise<StripeInvoice> {
    this.logCall('invoices.create', params);
    
    const subscription = params.subscription 
      ? subscriptions.get(params.subscription) 
      : null;
    
    const now = Math.floor(Date.now() / 1000);
    const invoice: StripeInvoice = {
      id: `inv_${invoiceIdCounter++}`,
      customer: params.customer,
      subscription: params.subscription,
      status: 'open',
      amountDue: subscription?.plan.amount || 0,
      amountPaid: 0,
      currency: 'usd',
      periodStart: subscription?.currentPeriodStart || now,
      periodEnd: subscription?.currentPeriodEnd || now + 30 * 24 * 60 * 60,
      created: now,
      hostedInvoiceUrl: `https://invoice.stripe.com/i/acct_test/${invoiceIdCounter}`,
      invoicePdf: `https://invoice.stripe.com/i/acct_test/${invoiceIdCounter}/pdf`,
    };
    
    invoices.set(invoice.id, invoice);
    return invoice;
  }

  async invoicesRetrieve(id: StripeInvoiceId): Promise<StripeInvoice | null> {
    this.logCall('invoices.retrieve', id);
    return invoices.get(id) || null;
  }

  async invoicesPay(id: StripeInvoiceId): Promise<StripeInvoice> {
    this.logCall('invoices.pay', id);
    
    const invoice = invoices.get(id);
    if (!invoice) throw new Error(`Invoice not found: ${id}`);
    
    invoice.status = 'paid';
    invoice.amountPaid = invoice.amountDue;
    invoices.set(id, invoice);
    return invoice;
  }

  async invoicesList(params: {
    customer: StripeCustomerId;
    status?: string;
  }): Promise<StripeInvoice[]> {
    this.logCall('invoices.list', params);
    
    return Array.from(invoices.values()).filter(
      inv => inv.customer === params.customer &&
        (!params.status || inv.status === params.status)
    );
  }

  // ==========================================================================
  // Payment Methods
  // ==========================================================================

  async paymentMethodsAttach(
    id: StripePaymentMethodId,
    params: { customer: StripeCustomerId }
  ): Promise<StripePaymentMethod> {
    this.logCall('paymentMethods.attach', id, params);
    
    const pm: StripePaymentMethod = {
      id,
      customer: params.customer,
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2025,
      },
      isDefault: paymentMethods.size === 0,
    };
    
    paymentMethods.set(id, pm);
    return pm;
  }

  async paymentMethodsDetach(id: StripePaymentMethodId): Promise<StripePaymentMethod> {
    this.logCall('paymentMethods.detach', id);
    
    const pm = paymentMethods.get(id);
    if (!pm) throw new Error(`Payment method not found: ${id}`);
    
    paymentMethods.delete(id);
    return pm;
  }

  async paymentMethodsList(params: {
    customer: StripeCustomerId;
    type?: string;
  }): Promise<StripePaymentMethod[]> {
    this.logCall('paymentMethods.list', params);
    
    return Array.from(paymentMethods.values()).filter(
      pm => pm.customer === params.customer &&
        (!params.type || pm.type === params.type)
    );
  }

  // ==========================================================================
  // Charges
  // ==========================================================================

  async chargesCreate(params: {
    amount: number;
    currency: string;
    customer: StripeCustomerId;
    description?: string;
  }): Promise<StripeCharge> {
    this.logCall('charges.create', params);
    
    const charge: StripeCharge = {
      id: `ch_${chargeIdCounter++}`,
      customer: params.customer,
      amount: params.amount,
      currency: params.currency,
      status: 'succeeded',
      description: params.description,
      receiptUrl: `https://receipt.stripe.com/${chargeIdCounter}`,
      created: Math.floor(Date.now() / 1000),
    };
    
    charges.set(charge.id, charge);
    return charge;
  }

  async chargesRetrieve(id: StripeChargeId): Promise<StripeCharge | null> {
    this.logCall('charges.retrieve', id);
    return charges.get(id) || null;
  }

  // ==========================================================================
  // Test Utilities
  // ==========================================================================

  getApiCalls(): string[] {
    return [...this.apiCalls];
  }

  clearApiCalls(): void {
    this.apiCalls = [];
  }

  clearAll(): void {
    customers.clear();
    subscriptions.clear();
    invoices.clear();
    paymentMethods.clear();
    charges.clear();
    this.apiCalls = [];
  }

// Helper to create a complete test customer with subscription
  async createTestCustomerWithSubscription(email: string, planId: StripePriceId): Promise<{
    customer: StripeCustomer;
    subscription: StripeSubscription;
  }> {
    const customer = await this.customersCreate({ email });
    const subscription = await this.subscriptionsCreate({
      customer: customer.id,
      items: [{ price: planId }],
    });
    return { customer, subscription };
  }
}

// ============================================================================
// Singleton for test reuse
// ============================================================================

let stripeInstance: MockStripe | null = null;

export function getStripeMock(): MockStripe {
  if (!stripeInstance) {
    stripeInstance = new MockStripe();
  }
  return stripeInstance;
}

export function resetStripeMock(): void {
  stripeInstance = null;
}

// ============================================================================
// Test Helper - Mock Stripe module
// ============================================================================

export function mockStripe() {
  const mock = getStripeMock();
  
  return {
    stripe: mock,
    MOCK_PLANS,
  };
}
