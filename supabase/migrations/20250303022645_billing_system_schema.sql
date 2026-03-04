-- Drop tables if they already exist (for idempotency during development)
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.stripe_customers CASCADE;

-- Table to map Supabase User ID to Stripe Customer ID
CREATE TABLE public.stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a user only has one Stripe Customer ID mapped
CREATE UNIQUE INDEX stripe_customers_user_id_idx ON public.stripe_customers(user_id);

-- Enable RLS for stripe_customers
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Subscriptions table (mirrors Stripe Subscription object partially)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Users can read their own stripe_customers mapping
CREATE POLICY "Users can view own stripe customer" ON public.stripe_customers
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role (Edge Functions/Backend) can INSERT/UPDATE/DELETE
-- We generally manage this via Edge Functions using service_role key, 
-- which bypasses RLS anyway, but good practice to explicitly lock it down from anon/authenticated.

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create updated_at trigger function if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END $$;

CREATE TRIGGER update_stripe_customers_updated_at
BEFORE UPDATE ON public.stripe_customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
