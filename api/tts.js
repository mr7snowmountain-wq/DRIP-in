module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // Remplacement phonétique des mots anglais pour lecture naturelle en français
  const phonetics = [
    [/\bstreet\s?wear\b/gi, 'stritwear'],
    [/\bold\s?money\b/gi, 'old money'],
    [/\bquiet\s?luxury\b/gi, 'kwayète loxury'],
    [/\btechwear\b/gi, 'tekwear'],
    [/\by2k\b/gi, 'why two kay'],
    [/\bsneakers\b/gi, 'snikeurse'],
    [/\bhoodie\b/gi, 'houdi'],
    [/\bcrop\s?top\b/gi, 'crop top'],
    [/\bbucket\s?hat\b/gi, 'beukit hat'],
    [/\boversized\b/gi, 'oversaïzd'],
    [/\bcolorblock\b/gi, 'colorblock'],
    [/\bblazer\b/gi, 'blazeur'],
    [/\btrench\b/gi, 'trench'],
    [/\bbodysuit\b/gi, 'bodisout'],
    [/\bjogger\b/gi, 'djogueur'],
    [/\btracksuit\b/gi, 'traksout'],
    [/\bbomber\b/gi, 'bomeuur'],
    [/\boutfit\b/gi, 'outfit'],
    [/\bstyling\b/gi, 'stayling'],
    [/\blook\b/gi, 'louk'],
    [/\bchunky\b/gi, 'tcheunki'],
    [/\bboho\b/gi, 'boho'],
    [/\bvintage\b/gi, 'vintidge'],
  ];
  phonetics.forEach(([re, ph]) => { text = text.replace(re, ph); });

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
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.2, pitch: 0.0 }
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
