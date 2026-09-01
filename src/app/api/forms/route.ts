import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

// GET /api/forms - List all forms for current user, or get a single form by ID
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check if single form ID is requested in query params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single form with questions
      const { data: form, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single();

      if (formError || !form) {
        return NextResponse.json({ error: 'Không tìm thấy khảo sát.' }, { status: 404 });
      }

      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('form_id', id)
        .order('order_index', { ascending: true });

      if (qError) {
        return NextResponse.json({ error: qError.message }, { status: 500 });
      }

      return NextResponse.json({ form, questions });
    }

    // Otherwise, list forms for authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { data: forms, error: formsError } = await supabase
      .from('forms')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (formsError) {
      return NextResponse.json({ error: formsError.message }, { status: 500 });
    }

    return NextResponse.json({ forms });
  } catch (error: any) {
    console.error('Error in GET /api/forms:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/forms - Create a new form and its questions
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập để thực hiện tác vụ này.' }, { status: 401 });
    }

    const { title, description, is_quiz, learning_settings, questions } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Khảo sát cần có tiêu đề.' }, { status: 400 });
    }

    // 1. Create Form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        title,
        description,
        is_quiz: is_quiz || false,
        learning_settings: learning_settings || null,
        user_id: user.id
      })
      .select()
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: `Lỗi tạo form: ${formError?.message}` }, { status: 500 });
    }

    // 2. Insert Questions if any
    if (questions && Array.isArray(questions) && questions.length > 0) {
      // Helper to normalize artificial IDs (e.g. "Q1", "q1", "1" -> "q1")
      const normalizeId = (id: any): string => {
        if (id === null || id === undefined) return '';
        const str = String(id).trim().toLowerCase();
        if (/^\d+$/.test(str)) {
          return `q${str}`;
        }
        return str;
      };

      const idMap: { [key: string]: string } = {};

      // Pass 1: Generate pre-assigned UUIDs
      const preparedQuestions = questions.map((q: any, index: number) => {
        const finalId = randomUUID();
        const localId = normalizeId(q.id || `q${index + 1}`);
        idMap[localId] = finalId;

        return {
          ...q,
          id: finalId
        };
      });

      // Pass 2: Map conditions and build insert payload
      const payload = preparedQuestions.map((q: any, index: number) => {
        let finalConditionId = null;
        const localConditionId = normalizeId(q.condition_question_id || q.visibility?.condition_question_id);
        if (localConditionId && idMap[localConditionId]) {
          finalConditionId = idMap[localConditionId];
        }

        return {
          id: q.id,
          form_id: form.id,
          type: q.type,
          text: q.text,
          options: q.options || [],
          correct_answer: q.correct_answer || null,
          is_required: q.is_required || false,
          order_index: index,
          is_branching_question: q.is_branching || q.is_branching_question || false,
          visibility_type: finalConditionId ? 'conditional' : 'always',
          condition_question_id: finalConditionId,
          condition_value: q.condition_value || q.visibility?.condition_value || null,
          difficulty: q.difficulty || 'medium',
          explanation: q.explanation || null,
          topic: q.topic || null
        };
      });

      const { error: qError } = await supabase
        .from('questions')
        .insert(payload);

      if (qError) {
        // Cleanup form on error
        await supabase.from('forms').delete().eq('id', form.id);
        return NextResponse.json({ error: `Lỗi tạo câu hỏi: ${qError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, formId: form.id });
  } catch (error: any) {
    console.error('Error in POST /api/forms:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}
