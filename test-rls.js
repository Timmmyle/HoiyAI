// test-rls.js
// Diagnosing Row-Level Security (RLS) policies programmatically
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Missing credentials in .env file.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);
const userClient = createClient(supabaseUrl, anonKey);

const testEmail = `test-rls-${Date.now()}@example.com`;
const testPassword = 'password123';

async function testRLS() {
  console.log(`1. Creating temporary test user: ${testEmail}...`);
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (authErr) {
    console.error("❌ Failed to create test user:", authErr.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`🟢 Temporary user created. ID: ${userId}`);

  try {
    // Manually ensure the profile exists in case trigger is slow or missing
    console.log("2. Ensuring profile row exists in public.profiles...");
    await adminClient.from('profiles').upsert({ id: userId, email: testEmail });

    console.log("3. Logging in as the test user to get a user session...");
    const { data: sessionData, error: loginErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr) {
      console.error("❌ Login failed:", loginErr.message);
      return;
    }

    console.log("🟢 Login success. Active user ID in session:", sessionData.user.id);

    // Make an insert query using the authenticated client
    console.log("4. Attempting to insert a form using the user client...");
    const { data: form, error: formError } = await userClient
      .from('forms')
      .insert({
        title: 'Khảo sát test RLS',
        description: 'Test RLS insertion',
        user_id: userId
      })
      .select()
      .single();

    if (formError) {
      console.error("❌ RLS Insert Failed with error:", formError);
    } else {
      console.log("🟢 RLS Insert SUCCESS! Form ID:", form.id);
      
      // Clean up form
      await adminClient.from('forms').delete().eq('id', form.id);
    }

  } catch (err) {
    console.error("❌ Exception during test:", err);
  } finally {
    console.log("5. Cleaning up temporary auth user...");
    await adminClient.auth.admin.deleteUser(userId);
    console.log("🟢 Cleanup complete.");
  }
}

testRLS();
