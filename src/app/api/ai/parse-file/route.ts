import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';

import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để sử dụng tính năng này.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.tier === 'FREE') {
      return NextResponse.json({ error: 'Tính năng tải file chỉ dành cho tài khoản gói Cơ bản trở lên.' }, { status: 403 });
    }
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let text = '';
    const filename = file.name.toLowerCase();

    if (filename.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (filename.endsWith('.pdf')) {
      const data = await pdf(buffer);
      text = data.text;
    } else {
      return NextResponse.json(
        { error: 'Định dạng file không hỗ trợ. Vui lòng tải file .txt, .docx hoặc .pdf' },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Error in /api/ai/parse-file:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi giải nén văn bản từ tệp.' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
