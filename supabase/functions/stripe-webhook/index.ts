import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature matching", { status: 400 });
  }

  const body = await req.text();
  const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret!);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Sometimes the mapping is passed via client metadata
        const userId = session.subscription_details?.metadata?.supabaseUUID || session.metadata?.supabaseUUID;

        if (session.mode === "subscription" && userId) {
          const subscriptionId = session.subscription;
          const stripeCustomerId = session.customer;

          // Retrieve full subscription object to get current dates
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);

          await supabaseAdmin.from("subscriptions").upsert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        // Find user by customer ID
        const { data: customerData } = await supabaseAdmin
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer)
          .single();

        if (customerData?.user_id) {
          await supabaseAdmin.from("subscriptions").upsert({
            user_id: customerData.user_id,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          });
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
});
