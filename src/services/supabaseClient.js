import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional, for admin tasks

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing in environment variables.");
    process.exit(1); // Exit if critical env vars are missing
}

// Supabase client for user-facing authentication (uses anon key)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase client for admin-level actions (uses service_role key)
// Only use this client on the backend/server-side for privileged operations.
const supabaseAdmin = supabaseServiceRoleKey 
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { 
        auth: { 
            persistSession: false // Prevents session creation for service role 
        } 
    })
    : null;

export { supabase, supabaseAdmin }; 