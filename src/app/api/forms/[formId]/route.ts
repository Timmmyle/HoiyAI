import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

// DELETE /api/forms/[formId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const supabase = createClient();
    const { formId } = params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Verify ownership
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('user_id')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Không tìm thấy khảo sát.' }, { status: 404 });
    }

    if (form.user_id !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xóa khảo sát này.' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('forms')
      .delete()
      .eq('id', formId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Xóa khảo sát thành công.' });
  } catch (error: any) {
    console.error('Error in DELETE /api/forms/[formId]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// PUT /api/forms/[formId] - Update form details and sync questions
export async function PUT(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const supabase = createClient();
    const { formId } = params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Verify ownership
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('user_id')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Không tìm thấy khảo sát.' }, { status: 404 });
    }

    if (form.user_id !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền sửa khảo sát này.' }, { status: 403 });
    }

    const { title, description, is_quiz, questions } = await req.json();

    // 1. Update form info
    const { error: updateFormError } = await supabase
      .from('forms')
      .update({ title, description, is_quiz: is_quiz || false })
      .eq('id', formId);

    if (updateFormError) {
      return NextResponse.json({ error: updateFormError.message }, { status: 500 });
    }

    // 2. Sync questions: delete and batch insert
    const { error: deleteQsError } = await supabase
      .from('questions')
      .delete()
      .eq('form_id', formId);

    if (deleteQsError) {
      return NextResponse.json({ error: deleteQsError.message }, { status: 500 });
    }

    if (questions && Array.isArray(questions) && questions.length > 0) {
      const idMap: { [key: string]: string } = {};

      // Pass 1: Generate pre-assigned UUIDs
      const preparedQuestions = questions.map((q: any, index: number) => {
        let finalId = q.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalId);
        if (!isUuid) {
          finalId = randomUUID();
        }
        
        const localId = q.id || `q${index + 1}`;
        idMap[localId] = finalId;

        return {
          ...q,
          id: finalId
        };
      });

      // Pass 2: Map conditions and build insert payload
      const payload = preparedQuestions.map((q: any, index: number) => {
        let finalConditionId = null;
        if (q.condition_question_id) {
          const condStr = String(q.condition_question_id);
          finalConditionId = idMap[condStr] || condStr;
        }

        return {
          id: q.id,
          form_id: formId,
          type: q.type,
          text: q.text,
          options: q.options || [],
          correct_answer: q.correct_answer || null,
          is_required: q.is_required || false,
          order_index: index,
          is_branching_question: q.is_branching_question || q.is_branching || false,
          visibility_type: finalConditionId ? 'conditional' : 'always',
          condition_question_id: finalConditionId,
          condition_value: q.condition_value || q.visibility?.condition_value || null
        };
      });

      const { error: qError } = await supabase
        .from('questions')
        .insert(payload);

      if (qError) {
        return NextResponse.json({ error: `Lỗi cập nhật câu hỏi: ${qError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in PUT /api/forms/[formId]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}
