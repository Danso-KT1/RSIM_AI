import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Fallback check to .env.example if missing in .env
if (fs.existsSync(path.join(process.cwd(), '.env.example'))) {
  try {
    const exampleParsed = dotenv.parse(fs.readFileSync(path.join(process.cwd(), '.env.example')));
    for (const [k, v] of Object.entries(exampleParsed)) {
      if (!process.env[k] && v && !v.includes('your-') && !v.includes('placeholder')) {
        process.env[k] = v;
      }
    }
  } catch {}
}

function maskKey(key?: string): string {
  if (!key || key.trim() === '' || key.includes('MY_') || key.includes('placeholder') || key.includes('your-api-key')) {
    return '\x1b[31m[NOT CONFIGURED / MISSING]\x1b[0m';
  }
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return `\x1b[32m[ACTIVE]\x1b[0m *** (${trimmed.length} chars)`;
  }
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `\x1b[32m[ACTIVE]\x1b[0m ${prefix}...${suffix} (${trimmed.length} chars)`;
}

const keyDefs = [
  { name: 'XAI_API_KEY', desc: 'xAI Grok Voice Transcribe 2.0 (Primary Speech-to-Text Engine)' },
  { name: 'GEMINI_API_KEY', desc: 'Google Gemini 3.8 / 2.5 Flash & Pro Models' },
  { name: 'OPENROUTER_API_KEY', desc: 'OpenRouter (GPT-4o, Perplexity, Nemotron, MiniMax)' },
  { name: 'GROQ_API_KEY', desc: 'GroqCloud Ultra-Fast LPU (Llama 3.3 70B & Whisper Fallback)' },
  { name: 'DEEPSEEK_API_KEY', desc: 'DeepSeek Chat & Reasoning' },
  { name: 'HF_TOKEN', desc: 'Hugging Face Inference Providers (Serverless Open Models)' },
  { name: 'OPENAI_API_KEY', desc: 'OpenAI Direct Engine (GPT-4o / o3-mini)' },
];

console.log('\n======================================================================');
console.log('  🔍 \x1b[1m\x1b[36mRSIM AI SYSTEM — API KEY ENVIRONMENT AUDIT\x1b[0m');
console.log('======================================================================');
let activeCount = 0;
for (const item of keyDefs) {
  const val = process.env[item.name];
  const isPresent = Boolean(val && val.trim() !== '' && !val.includes('MY_') && !val.includes('placeholder'));
  if (isPresent) activeCount++;
  console.log(`  🔑 \x1b[1m${item.name.padEnd(20)}\x1b[0m: ${maskKey(val)}`);
  console.log(`     └─ Service: ${item.desc}`);
}
console.log('----------------------------------------------------------------------');
console.log(`  📊 Summary: \x1b[1m${activeCount}/${keyDefs.length}\x1b[0m AI Provider API Keys detected and ready.`);
console.log('======================================================================\n');
