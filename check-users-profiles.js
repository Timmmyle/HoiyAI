// check-users-profiles.js
// Diagnosing RLS violations by comparing auth.users and public.profiles
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
  console.log("--- Fetching public.profiles ---");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) {
    console.error("Error fetching profiles:", pError.message);
    return;
  }
  console.log(`Profiles count: ${profiles.length}`);
  profiles.forEach(p => console.log(`- ID: ${p.id}, Email: ${p.email}`));

  console.log("\n--- Fetching auth.users ---");
  const { data: usersData, error: uError } = await supabase.auth.admin.listUsers();
  if (uError) {
    console.error("Error listing users:", uError.message);
    return;
  }
  console.log(`Auth users count: ${usersData.users.length}`);
  usersData.users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}`));

  // Find missing profiles
  const profileIds = new Set(profiles.map(p => p.id));
  const missingProfiles = usersData.users.filter(u => !profileIds.has(u.id));

  if (missingProfiles.length > 0) {
    console.log(`\n⚠️ FOUND MISMATCH: ${missingProfiles.length} auth users do not have a row in public.profiles!`);
    console.log("Synchronizing missing profiles...");
    for (const u of missingProfiles) {
      const { error: insErr } = await supabase.from('profiles').insert({ id: u.id, email: u.email });
      if (insErr) {
        console.error(`❌ Failed to sync profile for ${u.email}:`, insErr.message);
      } else {
        console.log(`✅ Synced profile for ${u.email}`);
      }
    }
  } else {
    console.log("\n🟢 No mismatch: All auth users have a matching public.profiles row.");
  }
}

run();
