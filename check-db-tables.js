// check-db-tables.js
// Diagnosing which tables are missing in the Supabase database
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
  console.error(e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = ['profiles', 'forms', 'questions', 'responses', 'answers'];

async function checkTables() {
  console.log("Checking Supabase tables existence...");
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(0);
      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
          console.log(`❌ Table 'public.${table}': MISSING (Not found in schema cache)`);
        } else {
          console.log(`⚠️ Table 'public.${table}': ERROR (${error.message})`);
        }
      } else {
        console.log(`🟢 Table 'public.${table}': EXISTS`);
      }
    } catch (err) {
      console.log(`❌ Table 'public.${table}': CRASHED (${err.message})`);
    }
  }
}

checkTables();
