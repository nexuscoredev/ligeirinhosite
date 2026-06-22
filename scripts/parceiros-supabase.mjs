export const PARCEIROS_SUPABASE_URL = 'https://tugbsnjyvfhyvtivfhea.supabase.co';

/** Chave anon pública do projeto Parceiros (JWT legacy). */
export const PARCEIROS_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Z2Jzbmp5dmZoeXZ0aXZmaGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTE3NTYsImV4cCI6MjA5NjU4Nzc1Nn0.JCxwHXshX2L3FHr0dkQpx_WzsMTEyEqSMwm-J5UmtTU';

export function parceirosSupabaseConfig(env = process.env) {
    const url = String(env.SUPABASE_URL || PARCEIROS_SUPABASE_URL).trim().replace(/\/$/, '');
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = String(env.SUPABASE_ANON_KEY || PARCEIROS_SUPABASE_ANON_KEY).trim();
    const apiKey = serviceKey || anonKey;
    return {
        url,
        serviceKey,
        anonKey,
        apiKey,
        useRpc: !serviceKey,
    };
}
