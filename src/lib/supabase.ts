import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

export async function uploadToSupabase(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase not configured");
  }
  const { data, error } = await admin.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return data;
}
