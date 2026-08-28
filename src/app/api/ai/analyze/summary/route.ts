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
    const { formTitle, summaryData } = await req.json();

    if (!formTitle || !summaryData || !Array.isArray(summaryData)) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu tóm tắt khảo sát.' },
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
        console.error('Error fetching user tier in summary analysis:', e);
      }
    }

    const activeModelChain = userTier === 'FREE'
      ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
      : MODEL_CHAIN;

    // 2. Format the data for the prompt
    const formattedData = summaryData.map((item: any, idx: number) => {
      let statsText = '';
      if (item.type === 'choice') {
        statsText = Object.keys(item.stats)
          .map(opt => `- ${opt}: ${item.stats[opt].count} lượt (${item.stats[opt].percent}%)`)
          .join('\n');
      } else if (item.type === 'scale') {
        statsText = `- Điểm trung bình: ${item.average}/5 Sao\n- Phân phối sao: 5 Sao (${item.distribution['5'] || 0} lượt), 4 Sao (${item.distribution['4'] || 0} lượt), 3 Sao (${item.distribution['3'] || 0} lượt), 2 Sao (${item.distribution['2'] || 0} lượt), 1 Sao (${item.distribution['1'] || 0} lượt)`;
      } else {
        statsText = `- Các ý kiến tiêu biểu:\n` + (item.answers || []).slice(0, 10).map((a: string) => `  * "${a}"`).join('\n');
      }

      return `Câu ${idx + 1} (${item.type.toUpperCase()}): "${item.text}"\n${statsText}`;
    }).join('\n\n');

    const prompt = `Bạn là chuyên gia phân tích dữ liệu nghiên cứu thị trường và trải nghiệm khách hàng.
Nhiệm vụ của bạn là phân tích dữ liệu tổng hợp của khảo sát "${formTitle}" dưới đây và viết một bản báo cáo tóm tắt thông thái (sử dụng định dạng Markdown đẹp, chuyên nghiệp, rõ ràng).

Báo cáo tóm tắt bắt buộc phải có các phần sau:
1. **Tổng quan kết quả:** Nhận xét chung về khảo sát, tỷ lệ và số lượng phản hồi.
2. **Các giá trị & phát hiện đáng chú ý nhất:** Phân tích sâu các con số/đáp án/ý kiến có sự chênh lệch lớn, đột biến, hoặc các insight quan trọng rút ra được từ số liệu (đặc biệt nhấn mạnh cái nào nổi bật và quan trọng nhất).
3. **Đề xuất hành động:** Đưa ra 3-4 lời khuyên thiết thực để cải thiện hoặc tối ưu hóa dựa trên phản hồi của người tham gia.

DỮ LIỆU KHẢO SÁT CHI TIẾT:
${formattedData}
`;

    let lastError = null;
    let replyText = '';

    for (const model of activeModelChain) {
      try {
        console.log(`[AI Summary] Requesting summary from model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Bạn là Trợ lý AI phân tích báo cáo khảo sát xuất sắc. Trả về câu trả lời bằng Markdown tiếng Việt.' },
            { role: 'user', content: prompt }
          ]
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          replyText = content;
          console.log(`[AI Summary] Successfully generated with model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Summary] Warning using model ${model}:`, err.message);
      }
    }

    if (!replyText) {
      throw new Error(`Tất cả các model AI đều lỗi hoặc hết quota: ${lastError?.message || 'Unknown error'}`);
    }

    return NextResponse.json({ summary: replyText });

  } catch (error: any) {
    console.error('Error in POST /api/ai/analyze/summary:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tạo tóm tắt báo cáo bằng AI.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
