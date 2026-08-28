import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
  'gpt-5.6-luna'
];

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not defined' }, { status: 500 });
    }

    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ questions: [] });
    }

    let lastError = null;
    let choice = null;

    for (const model of MODEL_CHAIN) {
      try {
        console.log(`[AI Split Router] Sending split request to OpenRouter with model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `Nhiệm vụ của bạn là đọc đoạn văn bản tiếng Việt sau và phân tích, trích xuất tất cả các câu hỏi phỏng vấn/khảo sát riêng lẻ từ đoạn văn bản đó thành một mảng JSON.
Mỗi phần tử câu hỏi trong mảng PHẢI có cấu trúc như sau:
{
  "text": "Nội dung câu hỏi đầy đủ (bao gồm cả số thứ tự câu nếu có, emoji, các ví dụ lựa chọn trong ngoặc nếu có)",
  "group": "Tên nhóm phỏng vấn hoặc phân loại lớn chứa câu hỏi đó (ví dụ: 'NHÓM CỘNG ĐỒNG THỰC HÀNH LÂN SƯ RỒNG' hoặc 'CHUYÊN GIA MỸ THUẬT'). Nếu câu hỏi không thuộc nhóm nào hoặc không rõ, đặt là null"
}

Hãy trích xuất ĐẦY ĐỦ tất cả các câu hỏi được cung cấp trong văn bản, không được lược bỏ, tóm tắt hay dùng dấu ba chấm (...).
BẮT BUỘC trả về kết quả dưới định dạng JSON sau (không bọc trong markdown \`\`\`json, không thêm bất kỳ văn bản giải thích nào khác ngoài JSON):
{
  "questions": [
    {
      "text": "...",
      "group": "..."
    }
  ]
}`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.1,
          max_tokens: 3000
        });

        const choiceMsg = response.choices[0]?.message;
        if (choiceMsg && choiceMsg.content) {
          choice = choiceMsg;
          console.log(`[AI Split Router] Success response with model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ Warning using model ${model} for splitting:`, err.message);
      }
    }

    if (!choice) {
      throw new Error(`Tất cả các model AI free đều lỗi hoặc hết quota: ${lastError?.message || 'Unknown error'}`);
    }

    let rawContent = (choice.content || '').trim();
    // Clean potential markdown blocks
    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.substring(7);
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.substring(3);
    }
    if (rawContent.endsWith('```')) {
      rawContent = rawContent.substring(0, rawContent.length - 3);
    }

    try {
      const parsed = JSON.parse(rawContent.trim());
      return NextResponse.json(parsed);
    } catch (e) {
      console.warn('[AI Split Router] JSON parse failed, attempting regex extraction of questions...');
      // Fallback regex parser to extract text blocks
      const questions: any[] = [];
      const braceRegex = /\{([^{}]+)\}/g;
      let match;
      while ((match = braceRegex.exec(rawContent)) !== null) {
        const block = match[1];
        const textMatch = block.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
        const groupMatch = block.match(/"group"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
        if (textMatch) {
          questions.push({
            text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
            group: groupMatch ? groupMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null
          });
        }
      }
      return NextResponse.json({ questions });
    }
  } catch (err: any) {
    console.error('[AI Split Error]:', err);
    return NextResponse.json({ error: err.message || 'Lỗi hệ thống AI Split' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
