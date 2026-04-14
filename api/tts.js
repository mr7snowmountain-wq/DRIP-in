module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_TTS_KEY missing' });

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'fr-FR', name: 'fr-FR-Studio-A' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.08, pitch: 0.0 }
        })
      }
    );
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'TTS error' });
    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
