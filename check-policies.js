// check-policies.js
// Inspecting active PostgreSQL policies on the tables
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

async function run() {
  console.log("Inspecting pg_policies for 'forms' table...");
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'forms' });
  
  if (error) {
    // If RPC doesn't exist, we can try running a custom SQL query via the SQL API, 
    // but since Supabase doesn't expose a direct SQL endpoint easily, we can query it using a rpc function
    // or try querying system catalogs. Wait, does supabase-js allow selecting from pg_catalog tables?
    // Let's test if we can query pg_policies directly!
    console.log("RPC failed. Trying direct query of pg_policies...");
  }
  
  try {
    const { data: directData, error: directError } = await supabase
      .from('pg_policies') // wait, pg_policies is a system view. Does postgrest expose system views?
      .select('*')
      .eq('tablename', 'forms');

    if (directError) {
      console.log("Cannot query pg_policies directly:", directError.message);
      
      // Let's run a check on forms table properties
      console.log("Checking RLS status on 'forms' table...");
      // Let's do a direct test of inserting using service role key, does it work?
      // Yes, we know from test-form-insert.js that it works. So the table exists.
    } else {
      console.log("Direct pg_policies query results:", directData);
    }
  } catch (err) {
    console.error("Error during catalog query:", err.message);
  }
}

run();
