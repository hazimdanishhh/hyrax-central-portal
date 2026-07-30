import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.rpc("auto_clock_out");

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
