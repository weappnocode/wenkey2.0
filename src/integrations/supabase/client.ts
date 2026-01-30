// ⚠️ Este arquivo pode ser gerado automaticamente por ferramentas do Supabase.
// Se for o seu caso, evite sobrescrever depois sem aplicar estas correções.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types"; // ajuste o path se necessário

// ✅ Variáveis corretas para Vite + Vercel
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
// Aceita tanto o nome clássico (ANON) quanto o usado nos scripts (.env / Docker)
const SUPABASE_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
) as string;

// 🛡️ Guard para evitar tela branca silenciosa
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY)."
  );
}

// ✅ Client Supabase pronto para frontend (SPA)
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  global: {
    headers: {
      "x-client-info": "supabase-js-web",
    },
  },
});
