import { createClient } from '@supabase/supabase-js';
const required = name => { if (!process.env[name]) throw new Error(`متغير البيئة ${name} مطلوب`); return process.env[name]; };
export const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
export const userClient = token => createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
export const ok = data => { if (data.error) throw data.error; return data.data; };
