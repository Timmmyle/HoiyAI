// test-ai.js
// Script to test OpenRouter API and the model fallback chain
// Run with: node test-ai.js

// Read and parse .env file manually
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn("Could not read .env file, using existing process.env variables:", e.message);
}
const OpenAI = require('openai');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("❌ ERROR: OPENROUTER_API_KEY is not defined in .env file.");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Using openrouter/free auto-router which automatically handles selecting available free models
const MODEL_CHAIN = [
  'openrouter/free',
  'z-ai/glm-5.2:free',
  'google/gemma-4-26b-a4b-it:free'
];

const mockText = `Q1: [RADIO] Bạn đi làm bằng phương tiện gì?
- Xe máy
- Ô tô
- Xe bus

BRANCH: Q1
- Nếu chọn "Xe máy" -> hiện thêm: Q2: [TEXT] Biển số xe của bạn là gì?`;

async function runTest() {
  console.log("🚀 Starting OpenRouter Fallback Chain Test...");
  console.log(`Mock document text:\n"${mockText}"\n`);

  for (const model of MODEL_CHAIN) {
    let retries = 3;
    let delay = 3000;

    while (retries > 0) {
      try {
        console.log(`Trying model: ${model}... (retries left: ${retries})`);
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Bạn là chatbot chuyển đổi văn bản sang JSON form. Hãy trả về JSON hợp lệ.' },
            { role: 'user', content: mockText }
          ],
          temperature: 0.2,
        });

        const content = response.choices[0]?.message?.content;
        console.log(`\n🟢 SUCCESS with model: ${model}`);
        console.log("Response content:\n", content);
        return;
      } catch (err) {
        console.warn(`⚠️ Warning with model ${model}:`, err.message);
        
        const isRateLimit = err.status === 429 || err.message.includes('429') || err.message.includes('rate');
        if (isRateLimit) {
          console.log(`Rate limit (429) hit. Waiting ${delay}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          // If it is another type of error, break to fallback to the next model in the chain
          break;
        }
        retries--;
      }
    }
  }

  console.error("\n❌ ALL MODELS IN THE CHAIN FAILED.");
}

runTest();
