// test-rls-jwt.js
// Inspecting JWT token sub claim and database auth.uid() matching
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

const adminClient = createClient(supabaseUrl, serviceKey);
const userClient = createClient(supabaseUrl, anonKey);

const testEmail = `test-jwt-${Date.now()}@example.com`;
const testPassword = 'password123';

function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log(`1. Creating test user: ${testEmail}...`);
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (authErr) {
    console.error("Failed to create test user:", authErr.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`🟢 User created. ID: ${userId}`);

  try {
    console.log("2. Ensuring profile row exists in public.profiles...");
    await adminClient.from('profiles').upsert({ id: userId, email: testEmail });

    console.log("3. Logging in...");
    const { data: sessionData, error: loginErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr) {
      console.error("Login failed:", loginErr.message);
      return;
    }

    const token = sessionData.session.access_token;
    console.log("🟢 Login Success.");
    console.log("Access Token JWT Header & Payload:");
    const payload = decodeJWT(token);
    console.log(payload);

    console.log(`\nDoes JWT 'sub' claim match User ID? ${payload.sub === userId ? 'YES' : 'NO'}`);
    console.log(`JWT Role: ${payload.role}`);

    // Let's check RLS insertion again
    console.log("\n4. Inserting form...");
    const { data: form, error: formError } = await userClient
      .from('forms')
      .insert({
        title: 'Khảo sát test RLS JWT',
        description: 'Testing token headers',
        user_id: userId
      })
      .select()
      .single();

    if (formError) {
      console.error("❌ RLS Insert Failed:", formError);
    } else {
      console.log("🟢 RLS Insert Success! Form ID:", form.id);
      await adminClient.from('forms').delete().eq('id', form.id);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await adminClient.auth.admin.deleteUser(userId);
    console.log("Cleanup done.");
  }
}

run();
