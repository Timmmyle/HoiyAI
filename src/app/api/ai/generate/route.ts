import { NextRequest, NextResponse } from 'next/server';
import { generateFormFromText } from '@/lib/ai/openrouter';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp nội dung văn bản khảo sát.' },
        { status: 400 }
      );
    }

    // Get user tier for model routing
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    let userTier = 'FREE';
    if (session) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', session.user.id)
          .single();
        if (profile?.tier) {
          userTier = profile.tier;
        }
      } catch (e) {
        console.error('Error fetching user tier in generate:', e);
      }
    }

    const result = await generateFormFromText(text, userTier);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/ai/generate:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi sinh khảo sát.' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
