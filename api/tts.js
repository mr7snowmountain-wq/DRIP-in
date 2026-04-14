function toSSML(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const ssml = escaped
    .replace(/\.\.\./g, '<break time="550ms"/>')
    .replace(/!(\s|$)/g, '!<break time="450ms"/>$1')
    .replace(/\?(\s|$)/g, '?<break time="450ms"/>$1')
    .replace(/\.(\s|$)/g, '.<break time="420ms"/>$1')
    .replace(/,(\s)/g, ',<break time="200ms"/>$1')
    .replace(/\s—\s/g, '<break time="350ms"/>')
    .replace(/\s:\s/g, '<break time="250ms"/>');

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
          voice: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 2.0 }
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
