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
    const { title, description, questions, mode, auditResult } = await req.json();

    if (!title || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu khảo sát (title, questions).' },
        { status: 400 }
      );
    }

    // Auth & Tier Routing
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
        console.error('Error fetching tier in survey audit:', e);
      }
    }

    const activeModelChain = userTier === 'FREE'
      ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
      : MODEL_CHAIN;

    if (mode === 'fix') {
      // Auto-fix mode: rewrite questions based on audit findings
      const prompt = `Bạn là chuyên gia sửa đổi & tối ưu hóa câu hỏi khảo sát (Survey Expert).
Nhiệm vụ của bạn là đọc các câu hỏi hiện tại và các lỗi/khuyến nghị đã được phát hiện trong lần kiểm định trước, sau đó TỰ ĐỘNG SỬA ĐỔI, TỐI ƯU CÂU HỎI VÀ ĐÁP ÁN cho hoàn hảo.

Tiêu đề khảo sát: "${title}"
Mô tả: "${description || ''}"

CÁC LỖI & ĐỀ XUẤT CẦN SỬA:
${JSON.stringify(auditResult || {}, null, 2)}

DANH SÁCH CÂU HỎI HIỆN TẠI:
${JSON.stringify(questions, null, 2)}

YÊU CẦU:
1. Giữ nguyên ID của các câu hỏi gốc nếu chỉ sửa lại văn bản hoặc tùy chọn.
2. Khắc phục tất cả các lỗi định hướng (leading questions), loại bỏ từ ngữ áp đặt, bổ sung các đáp án bị thiếu (như "Khác", "Không có ý kiến" nếu cần thiết).
3. Đảm bảo cấu trúc phân nhánh (is_branching_question, condition_question_id, condition_value) không bị đứt gãy.
4. Trả về định dạng JSON duy nhất như sau (không kèm markdown \`\`\`json):
{
  "fixedQuestions": [
    {
      "id": "chuỗi_ID_câu_hỏi",
      "type": "radio | checkbox | text | voice | scale | dropdown | date | file",
      "text": "Nội dung câu hỏi đã sửa chuẩn xác...",
      "options": ["Tùy chọn 1", "Tùy chọn 2", ...],
      "is_required": true,
      "is_branching_question": false,
      "visibility_type": "always",
      "condition_question_id": null,
      "condition_value": null,
      "correct_answer": null
    }
  ]
}
`;

      let lastError = null;
      let replyText = '';

      for (const model of activeModelChain) {
        try {
          console.log(`[AI Survey Fix] Requesting auto-fix from model ${model}...`);
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: 'Bạn là chuyên gia sửa đổi câu hỏi khảo sát. Chỉ trả về JSON hợp lệ.' },
              { role: 'user', content: prompt }
            ]
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            replyText = content;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Survey Fix] Warning with model ${model}:`, err.message);
        }
      }

      if (!replyText) {
        throw new Error(`AI lỗi khi tự động sửa: ${lastError?.message || 'Unknown error'}`);
      }

      let parsed = null;
      try {
        const cleaned = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('AI trả về kết quả sửa không đúng định dạng JSON.');
      }

      return NextResponse.json({ data: parsed });
    }

    // Default: Audit mode
    const formattedQuestions = questions.map((q: any, idx: number) => {
      const opts = Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((o: string) => `  - ${o}`).join('\n')
        : '  (Không có lựa chọn)';
      return `${idx + 1}. [ID: ${q.id}] Loại: ${q.type} - "${q.text}"\nCác tùy chọn:\n${opts}\nBắt buộc: ${q.is_required ? 'Có' : 'Không'} | Phân nhánh: ${q.is_branching_question ? 'Có' : 'Không'}`;
    }).join('\n\n');

    const prompt = `Bạn là chuyên gia kiểm tra chất lượng khảo sát và thiết kế bảng hỏi (Survey Methodology Expert).
Nhiệm vụ của bạn là đánh giá toàn diện khảo sát dưới đây để phát hiện các lỗi định hướng (leading questions), đáp án trùng lặp, thiếu tùy chọn, hoặc độ dài không tối ưu.

Tiêu đề khảo sát: "${title}"
Mô tả: "${description || ''}"

Danh sách câu hỏi:
${formattedQuestions}

Hãy đánh giá và trả về kết quả dưới dạng JSON chính xác như cấu trúc sau (không kèm markdown \`\`\`json):
{
  "score": 90,
  "grade": "Rất tốt / Cần cải thiện / Tốt",
  "estimatedTime": "3 - 5 phút",
  "strengths": [
    "Điểm mạnh 1 của khảo sát...",
    "Điểm mạnh 2..."
  ],
  "issues": [
    {
      "questionId": "q1",
      "severity": "warning",
      "message": "Chi tiết vấn đề phát hiện được ở câu hỏi này..."
    }
  ],
  "recommendations": [
    "Khuyên nên làm gì để tăng tỷ lệ điền bài...",
    "Khuyên sửa gì ở đâu..."
  ]
}
`;

    let lastError = null;
    let replyText = '';

    for (const model of activeModelChain) {
      try {
        console.log(`[AI Survey Audit] Sending request to model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia kiểm định bảng hỏi khảo sát. Chỉ trả về JSON hợp lệ.' },
            { role: 'user', content: prompt }
          ]
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          replyText = content;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Survey Audit] Warning with model ${model}:`, err.message);
      }
    }

    if (!replyText) {
      throw new Error(`Tất cả các model AI đều lỗi: ${lastError?.message || 'Unknown error'}`);
    }

    let parsed = null;
    try {
      const cleaned = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error('AI trả về kết quả không đúng định dạng JSON.');
    }

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error('Error in POST /api/ai/survey-audit:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi kiểm định khảo sát bằng AI.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
