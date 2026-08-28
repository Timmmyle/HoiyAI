import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const client = new OpenAI({
  baseURL: 'https://api.navy/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Website Survey AI'
  }
});

const MODEL_CHAIN = [
  'gpt-5.4-nano',
  'gemini-2.5-flash-lite',
  'gpt-5-mini',
  'gpt-5-nano'
];

export async function POST(req: NextRequest) {
  try {
    const { title, description, questions } = await req.json();

    if (!title || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu (title, questions).' },
        { status: 400 }
      );
    }

    // 1. Get user tier for model routing
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
        console.error('Error fetching user tier in quiz analysis:', e);
      }
    }

    const activeModelChain = userTier === 'FREE'
      ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
      : MODEL_CHAIN;

    const formattedQuestions = questions.map((q: any, idx: number) => {
      const optionsText = Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((opt: string) => `  - ${opt}`).join('\n')
        : '  (Không có lựa chọn)';
      return `${idx + 1}. [ID: ${q.id}] Loại: ${q.type} - Câu hỏi: "${q.text}"\nLựa chọn:\n${optionsText}`;
    }).join('\n\n');

    const prompt = `Bạn là chuyên gia phân tích nội dung giáo dục và khảo sát.
Nhiệm vụ của bạn là phân tích đề bài sau để quyết định xem đây là cuộc khảo sát ý kiến (survey) hay một bài tập/bài kiểm tra học tập (quiz/exercise).

Tiêu đề: "${title}"
Mô tả: "${description || ''}"

Danh sách các câu hỏi:
${formattedQuestions}

Hãy thực hiện:
1. Nhận định xem đây là Khảo sát (Survey) hay Bài tập có chấm điểm (Quiz/Exercise).
2. Nếu là Bài tập (Quiz/Exercise), hãy tìm đáp án đúng nhất cho từng câu hỏi có lựa chọn (radio, checkbox, dropdown, quiz_radio). Đáp án đúng phải là một trong những chuỗi lựa chọn được cung cấp.
3. Nếu là Khảo sát (Survey), hãy giải thích ngắn gọn và đặt "isQuiz" = false, nhưng vẫn đưa ra gợi ý đáp án khả dĩ ở trường "suggestedAnswers" đề phòng người dùng vẫn muốn bật chấm điểm.

Trả về kết quả dưới dạng JSON có cấu trúc chính xác như sau, không có text giải thích ngoài JSON:
{
  "isQuiz": true,
  "analysis": "Giải thích ngắn gọn tại sao đây là bài tập hoặc khảo sát...",
  "suggestedAnswers": {
    "question_id_1": "Chuỗi đáp án đúng 1",
    "question_id_2": "Chuỗi đáp án đúng 2"
  }
}
`;

    let lastError = null;
    let replyText = '';

    for (const model of activeModelChain) {
      try {
        console.log(`[AI Quiz Analyze] Sending request to model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia phân tích khảo sát và học tập. Chỉ trả về JSON hợp lệ.' },
            { role: 'user', content: prompt }
          ]
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          replyText = content;
          console.log(`[AI Quiz Analyze] Success response from model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Quiz Analyze] Warning using model ${model}:`, err.message);
      }
    }

    if (!replyText) {
      throw new Error(`Tất cả các model AI đều lỗi: ${lastError?.message || 'Unknown error'}`);
    }

    // Try parsing the JSON
    let parsed = null;
    try {
      // Strip markdown code block wrappers if any
      const cleaned = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.warn("Failed to parse JSON reply from AI, returning raw output:", replyText);
      throw new Error("AI trả về kết quả không đúng định dạng JSON.");
    }

    return NextResponse.json({ data: parsed });

  } catch (error: any) {
    console.error('Error in POST /api/ai/quiz-analyze:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi phân tích câu hỏi bằng AI.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
