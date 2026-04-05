// api/webhooks/lemonsqueezy.js
// Vercel Serverless Function — Webhook Lemon Squeezy
// Deploy path: /api/webhooks/lemonsqueezy

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase client avec service_role (côté serveur uniquement)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vérifier la signature HMAC du webhook Lemon Squeezy
function verifySignature(rawBody, signature) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "hex"),
    Buffer.from(signature, "hex")
  );
}

export const config = {
  api: { bodyParser: false }, // on a besoin du raw body pour la vérification HMAC
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Récupérer l'user_id Supabase depuis le custom_data ou l'email client
async function resolveUserId(payload) {
  const customData = payload.meta?.custom_data;

  // Option 1 : user_id passé dans custom_data lors du checkout
  if (customData?.user_id) {
    return customData.user_id;
  }

  // Option 2 : retrouver par customer_id LS déjà enregistré
  const customerId = payload.data?.attributes?.customer_id?.toString();
  if (customerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("lemon_squeezy_customer_id", customerId)
      .single();
    if (data) return data.id;
  }

  // Option 3 : retrouver par email
  const email =
    payload.data?.attributes?.user_email ||
    payload.data?.attributes?.customer_email;
  if (email) {
    const { data: authUser } = await supabase.auth.admin.getUserByEmail(email);
    if (authUser?.user) return authUser.user.id;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers["x-signature"];

  // Vérification de la signature
  if (!signature || !verifySignature(rawBody, signature)) {
    console.error("[LS Webhook] Invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const eventName = payload.meta?.event_name;
  console.log(`[LS Webhook] Event: ${eventName}`);

  // Logger l'événement brut
  await supabase.from("lemon_squeezy_events").insert({
    event_name: eventName,
    payload,
    processed: false,
  });

  try {
    const userId = await resolveUserId(payload);

    if (!userId) {
      console.error("[LS Webhook] Cannot resolve user_id for event:", eventName);
      return res.status(200).json({ received: true, warning: "user_not_found" });
    }

    const attrs = payload.data?.attributes || {};
    const customerId = attrs.customer_id?.toString() || "";
    const subscriptionId = payload.data?.id?.toString() || "";
    const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;

    switch (eventName) {
      // Abonnement créé ou réactivé
      case "subscription_created":
      case "subscription_resumed":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "active",
          p_ends_at: endsAt,
        });
        console.log(`[LS] User ${userId} → PRO (active)`);
        break;

      // Paiement réussi (renouvellement mensuel)
      case "subscription_payment_success":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "active",
          p_ends_at: endsAt,
        });
        break;

      // Abonnement mis en pause
      case "subscription_paused":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "paused",
          p_ends_at: endsAt,
        });
        break;

      // Annulation (accès maintenu jusqu'à la fin de la période)
      case "subscription_cancelled":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "cancelled",
          p_ends_at: endsAt,
        });
        break;

      // Expiration définitive
      case "subscription_expired":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "expired",
          p_ends_at: null,
        });
        // Repasser en free
        await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", userId);
        break;

      // Paiement échoué
      case "subscription_payment_failed":
        await supabase.rpc("update_subscription", {
          p_user_id: userId,
          p_customer_id: customerId,
          p_subscription_id: subscriptionId,
          p_status: "paused",
          p_ends_at: endsAt,
        });
        break;

      default:
        console.log(`[LS Webhook] Unhandled event: ${eventName}`);
    }

    // Marquer l'événement comme traité
    await supabase
      .from("lemon_squeezy_events")
      .update({ processed: true })
      .eq("event_name", eventName)
      .order("created_at", { ascending: false })
      .limit(1);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[LS Webhook] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
