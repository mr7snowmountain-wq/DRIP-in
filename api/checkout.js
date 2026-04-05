// api/checkout.js
// Crée une session de checkout Lemon Squeezy avec l'user_id dans custom_data

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Récupérer le token JWT Supabase depuis le header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  // Vérifier le token avec Supabase
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID;
  const VARIANT_ID = process.env.LEMON_SQUEEZY_VARIANT_ID; // ID du variant 9.90€/mois
  const LS_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;

  try {
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${LS_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: {
              embed: false,
              media: true,
              logo: true,
            },
            checkout_data: {
              email: user.email,
              custom: {
                user_id: user.id, // Clé pour retrouver l'utilisateur dans le webhook
              },
            },
            expires_at: null,
            preview: false,
          },
          relationships: {
            store: {
              data: { type: "stores", id: STORE_ID },
            },
            variant: {
              data: { type: "variants", id: VARIANT_ID },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Checkout] Lemon Squeezy error:", err);
      return res.status(500).json({ error: "Failed to create checkout" });
    }

    const data = await response.json();
    const checkoutUrl = data.data?.attributes?.url;

    return res.status(200).json({ url: checkoutUrl });
  } catch (error) {
    console.error("[Checkout] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
