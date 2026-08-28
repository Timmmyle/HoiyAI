// test-insert.js
// Script to test database schema and profiles presence
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
// Use service role key to inspect schema freely bypassing RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Checking profiles table...");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  
  if (pError) {
    console.error("❌ Error fetching profiles. Table might not exist or schema.sql wasn't run:", pError.message);
    process.exit(1);
  }

  console.log(`🟢 Profiles table exists. Rows found: ${profiles.length}`);
  console.log(profiles);

  if (profiles.length === 0) {
    console.warn("⚠️ Warning: No profiles found. If you created a user, the trigger might not have run or schema.sql was run AFTER user creation.");
    
    // Check auth users list
    console.log("Checking auth.users...");
    const { data: usersData, error: uError } = await supabase.auth.admin.listUsers();
    if (uError) {
      console.error("Could not list auth users:", uError.message);
    } else {
      console.log(`Auth users found: ${usersData.users.length}`);
      usersData.users.forEach(u => {
        console.log(`- ID: ${u.id}, Email: ${u.email}`);
      });
      
      // Propose synchronization fix: insert the missing profiles manually
      if (usersData.users.length > 0) {
        console.log("Synchronizing missing profiles...");
        for (const u of usersData.users) {
          const { error: insErr } = await supabase.from('profiles').insert({ id: u.id, email: u.email });
          if (insErr) {
            console.error(`Failed to sync profile for ${u.email}:`, insErr.message);
          } else {
            console.log(`Synced profile for ${u.email}`);
          }
        }
      }
    }
  }
}

runTest();
