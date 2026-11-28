import fs from 'node:fs';
import path from 'node:path';
import { SarvamAIClient, audio } from 'sarvamai';

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error('Missing SARVAM_API_KEY in environment (.env).');
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
const outFile = path.join(process.cwd(), 'output', 'sarvam-first-call.wav');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const response = await client.textToSpeech.convert({
  text: '48 thousand by Oviya. Bid 47 lakh 49 thousand 7 hundred by Yogeshwaran.',
  language_code: 'en-IN',
  model: 'bulbul:v3',
  speaker: 'shubh',
  enable_preprocessing: true,
});

await audio.save(response, outFile);
const stats = fs.statSync(outFile);
console.log('Sarvam TTS first call succeeded!');
console.log('Request ID:', response.request_id ?? 'n/a');
console.log('Audio chunks:', response.audios.length);
console.log('Saved file:', outFile, `(${stats.size} bytes)`);
