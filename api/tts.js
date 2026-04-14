const EN_WORDS = [
  'streetwear','old money','quiet luxury','techwear','sneakers','hoodie',
  'crop top','bucket hat','oversized','colorblock','trench coat','wide leg',
  'bodysuit','legging','jogger','tracksuit','bomber','puffer','loafers',
  'chunky','outfit','styling','total look','straight leg','slim fit'
];

function toSSML(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Wrap English fashion words with safe regex (no invalid ranges)
  EN_WORDS.forEach(word => {
    try {
      const pattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s]+/g, '[\\s]+');
      const re = new RegExp('(?:^|\\s)(' + pattern + ')(?=\\s|[,\\.!?]|$)', 'gi');
      escaped = escaped.replace(re, (m, w) => m.replace(w, `<lang xml:lang="en-US">${w}</lang>`));
    } catch(e) { /* skip */ }
  });

  // Pauses minimales uniquement sur ... et !
  const ssml = escaped
    .replace(/\.\.\./g, '<break time="200ms"/>')
    .replace(/!(\s|$)/g, '!<break time="150ms"/>$1');

  return `<speak>${ssml}</speak>`;
}

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
          input: { ssml: toSSML(text) },
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
