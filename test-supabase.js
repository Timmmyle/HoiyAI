// test-supabase.js
// Diagnosing the 500 error by running a query directly
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables manually with the same logic
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        // Parse with/without quotes and spaces
        const rawValue = parts.slice(1).join('=').trim();
        const cleanValue = rawValue.replace(/(^["']|["']$)/g, ''); // strip quotes
        process.env[key] = cleanValue;
      }
    });
  }
} catch (e) {
  console.error("Error loading .env", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL loaded:", `"${supabaseUrl}"`);
console.log("Supabase Key loaded:", `"${supabaseKey ? supabaseKey.substring(0, 15) + '...' : 'undefined'}"`);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Testing connection to 'forms' table...");
  try {
    const { data, error } = await supabase.from('forms').select('*').limit(1);
    if (error) {
      console.error("❌ Database query returned error:", error);
    } else {
      console.log("🟢 Connection Successful! Data returned:", data);
    }
  } catch (err) {
    console.error("❌ Exception during connection test:", err);
  }
}

runTest();
