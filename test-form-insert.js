// test-form-insert.js
// Simulate exact insertion query to identify 500 error root cause
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
const testUserId = 'db589aaf-20ad-407d-ae41-9a3b4fe50256'; // the profile ID found in database

async function testInsert() {
  console.log(`Starting mock insert for user_id: ${testUserId}`);
  
  // 1. Insert Form
  const { data: form, error: formError } = await supabase
    .from('forms')
    .insert({
      title: 'Khảo sát Test 500',
      description: 'Mô tả test lỗi 500',
      user_id: testUserId
    })
    .select()
    .single();

  if (formError) {
    console.error("❌ Form Insert Failed:", formError);
    return;
  }

  console.log("🟢 Form Insert Success! Form ID:", form.id);

  // 2. Insert Questions with branching logic representation
  const questions = [
    {
      type: 'radio',
      text: 'Bạn thuộc nhóm nào?',
      options: ['Nhóm A', 'Nhóm B'],
      is_branching_question: true,
      visibility_type: 'always'
    },
    {
      type: 'text',
      text: 'Biển số xe của bạn?',
      options: [],
      is_branching_question: false,
      visibility_type: 'conditional'
      // condition_question_id will be mapped
    }
  ];

  console.log("Inserting questions...");
  const insertedQs = [];
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: qData, error: qError } = await supabase
      .from('questions')
      .insert({
        form_id: form.id,
        type: q.type,
        text: q.text,
        options: q.options,
        correct_answer: null,
        is_required: false,
        order_index: i,
        is_branching_question: q.is_branching_question,
        visibility_type: q.visibility_type,
        condition_question_id: null,
        condition_value: null
      })
      .select()
      .single();

    if (qError) {
      console.error(`❌ Question #${i+1} Insert Failed:`, qError);
      // Clean up
      await supabase.from('forms').delete().eq('id', form.id);
      return;
    }
    insertedQs.push(qData);
    console.log(`🟢 Question #${i+1} Insert Success! ID: ${qData.id}`);
  }

  // Update branching link
  console.log("Updating branching condition...");
  const { error: updateError } = await supabase
    .from('questions')
    .update({
      condition_question_id: insertedQs[0].id,
      condition_value: 'Nhóm A',
      visibility_type: 'conditional'
    })
    .eq('id', insertedQs[1].id);

  if (updateError) {
    console.error("❌ Branching Update Failed:", updateError);
  } else {
    console.log("🟢 Branching Update Success!");
  }

  // Cleanup
  console.log("Cleaning up inserted test form...");
  await supabase.from('forms').delete().eq('id', form.id);
  console.log("🟢 Cleanup complete.");
}

testInsert();
