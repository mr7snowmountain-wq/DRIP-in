// api/webhooks/lemonsqueezy.js
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function verifySignature(rawBody, signature) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
  } catch { return false; }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function resolveUserId(payload) {
  const customData = payload.meta?.custom_data;
  if (customData?.user_id) return customData.user_id;

  const customerId = payload.data?.attributes?.customer_id?.toString();
  if (customerId) {
    const { data } = await supabase.from('profiles').select('id').eq('lemon_squeezy_customer_id', customerId).single();
    if (data) return data.id;
  }

  const email = payload.data?.attributes?.user_email || payload.data?.attributes?.customer_email;
  if (email) {
    const { data: authUser } = await supabase.auth.admin.getUserByEmail(email);
    if (authUser?.user) return authUser.user.id;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-signature'];

  if (!signature || !verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const eventName = payload.meta?.event_name;

  await supabase.from('lemon_squeezy_events').insert({ event_name: eventName, payload, processed: false });

  const userId = await resolveUserId(payload);
  if (!userId) return res.status(200).json({ received: true, warning: 'user_not_found' });

  const attrs = payload.data?.attributes || {};
  const customerId     = attrs.customer_id?.toString() || '';
  const subscriptionId = payload.data?.id?.toString() || '';
  const endsAt         = attrs.ends_at ? new Date(attrs.ends_at) : null;

  const rpcArgs = { p_user_id: userId, p_customer_id: customerId, p_subscription_id: subscriptionId };

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_resumed':
    case 'subscription_payment_success':
      await supabase.rpc('update_subscription', { ...rpcArgs, p_status: 'active', p_ends_at: endsAt });
      break;
    case 'subscription_paused':
    case 'subscription_payment_failed':
      await supabase.rpc('update_subscription', { ...rpcArgs, p_status: 'paused', p_ends_at: endsAt });
      break;
    case 'subscription_cancelled':
      await supabase.rpc('update_subscription', { ...rpcArgs, p_status: 'cancelled', p_ends_at: endsAt });
      break;
    case 'subscription_expired':
      await supabase.rpc('update_subscription', { ...rpcArgs, p_status: 'expired', p_ends_at: null });
      await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId);
      break;
  }

  return res.status(200).json({ received: true });
};
