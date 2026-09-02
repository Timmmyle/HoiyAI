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
    const { formTitle, summaryData, messages } = await req.json();

    if (!formTitle || !summaryData || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu để trò chuyện.' },
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
        console.error('Error fetching user tier in summary chat:', e);
      }
    }

    const activeModelChain = userTier === 'FREE'
      ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
      : MODEL_CHAIN;

    // 2. Format the survey data
    const formattedData = summaryData.map((item: any, idx: number) => {
      let statsText = '';
      if (item.type === 'choice') {
        statsText = Object.keys(item.stats)
          .map(opt => `- ${opt}: ${item.stats[opt].count} lượt (${item.stats[opt].percent}%)`)
          .join('\n');
      } else if (item.type === 'scale') {
        statsText = `- Điểm trung bình: ${item.average}/5 Sao\n- Phân phối sao: 5 Sao (${item.distribution['5'] || 0} lượt), 4 Sao (${item.distribution['4'] || 0} lượt), 3 Sao (${item.distribution['3'] || 0} lượt), 2 Sao (${item.distribution['2'] || 0} lượt), 1 Sao (${item.distribution['1'] || 0} lượt)`;
      } else {
        statsText = `- Các ý kiến tiêu biểu:\n` + (item.answers || []).slice(0, 15).map((a: string) => `  * "${a}"`).join('\n');
      }

      return `Câu ${idx + 1} (${item.type.toUpperCase()}): "${item.text}"\n${statsText}`;
    }).join('\n\n');

    const systemPrompt = `Bạn là Trợ lý AI phân tích kết quả nghiên cứu thị trường xuất sắc của mustring.com.
Nhiệm vụ của bạn là hỗ trợ người dùng đọc hiểu, phân tích sâu, và đề xuất các giải pháp thực tế từ số liệu báo cáo của cuộc khảo sát "${formTitle}".

DỮ LIỆU KẾT QUẢ KHẢO SÁT CHI TIẾT:
${formattedData}

QUY TẮC PHẢN HỒI:
1. Trả lời bằng tiếng Việt, thân thiện, súc tích và chuyên nghiệp.
2. Luôn bám sát số liệu thực tế được cung cấp ở trên. Không tự ý bịa đặt số liệu.
3. Nếu người dùng hỏi những thông tin ngoài lề không liên quan đến cuộc khảo sát này, hãy khéo léo và lịch sự hướng họ quay lại nội dung báo cáo khảo sát.
4. Trình bày bằng markdown (bold, list) rõ ràng để người dùng dễ theo dõi.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    let lastError = null;
    let replyText = '';

    for (const model of activeModelChain) {
      try {
        console.log(`[AI Report Chat] Sending request to model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: apiMessages,
          max_tokens: 2000
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          replyText = content;
          console.log(`[AI Report Chat] Success response with model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Report Chat] Warning using model ${model}:`, err.message);
      }
    }

    if (!replyText) {
      throw new Error(`Tất cả các model AI đều lỗi hoặc hết quota: ${lastError?.message || 'Unknown error'}`);
    }

    return NextResponse.json({
      role: 'assistant',
      content: replyText
    });

  } catch (error: any) {
    console.error('Error in POST /api/ai/analyze/chat:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống AI trò chuyện.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
