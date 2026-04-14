const EN_WORDS = [
  'streetwear','street style','old money','quiet luxury','techwear','y2k',
  'sneakers','hoodie','crop top','bucket hat','oversized','boyfriend',
  'colorblock','color block','trench coat','wide leg','high waist',
  'blazer fit','outfit','look','styling','must-have','total look',
  'bodysuit','legging','jogger','tracksuit','bomber','puffer',
  'loafers','derbies','chunky','slim fit','straight leg'
];

function toSSML(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Wrap English fashion words for correct pronunciation
  EN_WORDS.forEach(word => {
    const re = new RegExp('\\b' + word.replace(/[-]/g,'[- ]') + '\\b', 'gi');
    escaped = escaped.replace(re, m => `<lang xml:lang="en-US">${m}</lang>`);
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
