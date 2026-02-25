import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  
  // Get signature from headers
  const signature = request.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET || !signature) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.customer && session.subscription) {
          // Update organization with Stripe customer and subscription
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Find organization by stripe customer ID
          const organization = await prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
          });

          if (organization) {
            // Get subscription details
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscription.items.data[0]?.price.id;

            // Determine plan based on price
            let plan = "STARTER";
            if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";
            else if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) plan = "GROWTH";
            else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) plan = "ENTERPRISE";

            await prisma.organization.update({
              where: { id: organization.id },
              data: {
                stripeSubId: subscriptionId,
                plan: plan as any,
              },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        const organization = await prisma.organization.findFirst({
          where: { stripeSubId: subscription.id },
        });

        if (organization) {
          const priceId = subscription.items.data[0]?.price.id;
          
          let plan = "STARTER";
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";
          else if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) plan = "GROWTH";
          else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) plan = "ENTERPRISE";

          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              plan: plan as any,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        const organization = await prisma.organization.findFirst({
          where: { stripeSubId: subscription.id },
        });

        if (organization) {
          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              plan: "STARTER",
              stripeSubId: null,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Could send email notification here
        console.log("Payment failed for invoice:", invoice.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
