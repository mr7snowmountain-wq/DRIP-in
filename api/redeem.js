// api/redeem.js
// Vercel Serverless — Utiliser un code promo

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.slice(7);
  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  const { data, error: rpcError } = await supabase.rpc('redeem_promo_code', {
    p_user_id: user.id,
    p_code: code.trim().toUpperCase()
  });

  if (rpcError) return res.status(500).json({ error: rpcError.message });

  return res.status(200).json(data);
}
