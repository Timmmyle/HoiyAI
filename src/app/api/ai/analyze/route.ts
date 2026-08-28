import { NextRequest, NextResponse } from 'next/server';
import { analyzeResponsesWithAI } from '@/lib/ai/openrouter';

export async function POST(req: NextRequest) {
  try {
    const { formTitle, questionText, answers } = await req.json();

    if (!formTitle || !questionText || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu để phân tích (formTitle, questionText, answers).' },
        { status: 400 }
      );
    }

    if (answers.length === 0) {
      return NextResponse.json({
        summary: 'Chưa có câu trả lời nào để phân tích.',
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        topics: [],
        insights: ['Chưa thu thập đủ dữ liệu.']
      });
    }

    const analysis = await analyzeResponsesWithAI(formTitle, questionText, answers);
    return NextResponse.json({ data: analysis });
  } catch (error: any) {
    console.error('Error in /api/ai/analyze:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi phân tích dữ liệu bằng AI.' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
