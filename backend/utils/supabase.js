require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// القيم المباشرة
const SUPABASE_URL = 'https://xgglyxhlctfuldsywrhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZ2x5eGhsY3RmdWxkc3l3cmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTY0MjgsImV4cCI6MjEwMTQzMjQyOH0.Od8c54gMvHzXEg_3YljLBrsvyDnESGT2aP-g_o_kVLI';

// استبدل هذا بالمفتاح الحقيقي لـ service_role من لوحة تحكم Supabase
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZ2x5eGhsY3RmdWxkc3l3cmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTY0MjgsImV4cCI6MjEwMTQzMjQyOH0.Od8c54gMvHzXEg_3YljLBrsvyDnESGT2aP-g_o_kVLI';

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const userClient = (token) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
    },
  });

const ok = (data) => {
  if (data.error) throw data.error;
  return data.data;
};

module.exports = {
  admin,
  userClient,
  ok,
};
