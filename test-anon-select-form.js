// test-anon-select-form.js
const { createClient } = require('@supabase/supabase-js');
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
        const rawValue = parts.slice(1).join('=').trim();
        const cleanValue = rawValue.replace(/(^["']|["']$)/g, '');
        process.env[key] = cleanValue;
      }
    });
  }
} catch (e) {
  console.error("Failed to load .env:", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSelect() {
  const formId = "1c2c0a5a-ace8-4292-931e-7a915df34c64";
  console.log(`Attempting to SELECT form ${formId} with Anon Key...`);
  
  const { data, error } = await supabase
    .from('forms')
    .select('id, title')
    .eq('id', formId);

  if (error) {
    console.error("❌ SELECT FAILED:", error);
  } else {
    console.log("🟢 SELECT SUCCESS:", data);
  }
}

testSelect();
