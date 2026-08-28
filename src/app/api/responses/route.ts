import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Initialize a secure admin client to bypass select policy restrictions during anonymous submission inserts
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// POST /api/responses - Submit answers to a form
export async function POST(req: NextRequest) {
  try {
    const { formId, answers } = await req.json();

    if (!formId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Dữ liệu không đầy đủ (formId, answers).' }, { status: 400 });
    }

    // Get client info
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Create response entry using supabaseAdmin (to bypass select policies for returning data)
    const { data: response, error: responseError } = await supabaseAdmin
      .from('responses')
      .insert({
        form_id: formId,
        user_agent: userAgent,
        ip_address: ipAddress
      })
      .select()
      .single();

    if (responseError || !response) {
      return NextResponse.json({ error: `Lỗi ghi nhận đợt phản hồi: ${responseError?.message}` }, { status: 500 });
    }

    // 2. Insert answers
    const answersData = answers.map((ans: any) => ({
      response_id: response.id,
      question_id: ans.questionId,
      value: typeof ans.value === 'object' ? JSON.stringify(ans.value) : String(ans.value),
      audio_url: ans.audioUrl || null
    }));

    const { error: answersError } = await supabaseAdmin
      .from('answers')
      .insert(answersData);

    if (answersError) {
      // Rollback response entry
      await supabaseAdmin.from('responses').delete().eq('id', response.id);
      return NextResponse.json({ error: `Lỗi lưu câu trả lời: ${answersError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, responseId: response.id });
  } catch (error: any) {
    console.error('Error in POST /api/responses:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// GET /api/responses - Fetch all responses for a form (Owner-only check performed)
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get('formId');

    if (!formId) {
      return NextResponse.json({ error: 'Thiếu tham số formId.' }, { status: 400 });
    }

    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Validate form ownership
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('user_id')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Không tìm thấy khảo sát.' }, { status: 404 });
    }

    if (form.user_id !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu của khảo sát này.' }, { status: 403 });
    }

    // Load responses
    const { data: responses, error: rError } = await supabase
      .from('responses')
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false });

    if (rError) {
      return NextResponse.json({ error: rError.message }, { status: 500 });
    }

    // Load answers
    const responseIds = responses.map((r: any) => r.id);
    let answers: any[] = [];
    
    if (responseIds.length > 0) {
      const { data: answersData, error: aError } = await supabase
        .from('answers')
        .select('*')
        .in('response_id', responseIds);

      if (aError) {
        return NextResponse.json({ error: aError.message }, { status: 500 });
      }
      answers = answersData || [];
    }

    return NextResponse.json({ responses, answers });
  } catch (error: any) {
    console.error('Error in GET /api/responses:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
