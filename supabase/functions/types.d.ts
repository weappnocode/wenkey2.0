// Minimal types to make editors happy when working on Supabase edge functions.
type EdgeHandler = (request: Request) => Response | Promise<Response>;

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };

  function serve(
    handler: EdgeHandler,
    options?: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal;
      onListen?: (params: { hostname: string; port: number }) => void;
    }
  ): unknown;
}

// --- Deno std library (all versions used in project) ---
declare module 'https://deno.land/std@0.190.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

// --- npm: specifiers ---
declare module 'npm:stripe@14.14.0' {
  import Stripe from 'stripe';
  export default Stripe;
}

declare module 'npm:google-auth-library@^9.7.0' {
  export { JWT } from 'google-auth-library';
}

// --- esm.sh modules ---
declare module 'https://esm.sh/@supabase/supabase-js@2.45.0' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/@supabase/supabase-js@2.47.10' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/@supabase/supabase-js@2.76.1' {
  export * from '@supabase/supabase-js';
}

// --- Edge Runtime types ---
declare module 'https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts' { }
