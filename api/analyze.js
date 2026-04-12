const { createClient } = require('@supabase/supabase-js');

const FREE_LIMIT = 5;
const PRO_LIMIT = 300;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante' });

  // Vérif auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = authHeader.slice(7);

  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'unauthorized' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, credits, credits_reset_at, pro_analyses_this_month, pro_analyses_reset_at, is_admin')
    .eq('id', user.id)
    .single();

  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  // Vérif quota (les admins passent toujours)
  if (!profile.is_admin) {
    const now = new Date();
    const plan = profile.plan || 'free';

    if (plan === 'free') {
      const resetAt = profile.credits_reset_at ? new Date(profile.credits_reset_at) : null;
      let credits = profile.credits ?? FREE_LIMIT;

      // Reset si nouveau mois
      if (!resetAt || now >= resetAt) {
        credits = FREE_LIMIT;
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await supabase.from('profiles').update({ credits: FREE_LIMIT, credits_reset_at: nextReset.toISOString() }).eq('id', user.id);
      }

      if (credits <= 0) {
        return res.status(402).json({ error: 'quota_exceeded', plan: 'free' });
      }

      await supabase.from('profiles').update({ credits: credits - 1 }).eq('id', user.id);

    } else {
      // Plan pro / active
      const resetAt = profile.pro_analyses_reset_at ? new Date(profile.pro_analyses_reset_at) : null;
      let count = profile.pro_analyses_this_month ?? 0;

      if (!resetAt || now >= resetAt) {
        count = 0;
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await supabase.from('profiles').update({ pro_analyses_this_month: 0, pro_analyses_reset_at: nextReset.toISOString() }).eq('id', user.id);
      }

      if (count >= PRO_LIMIT) {
        return res.status(402).json({ error: 'quota_exceeded', plan: 'pro' });
      }

      await supabase.from('profiles').update({ pro_analyses_this_month: count + 1 }).eq('id', user.id);
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
