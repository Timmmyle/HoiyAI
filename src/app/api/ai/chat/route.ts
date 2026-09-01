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

const SYSTEM_PROMPT_CHAT = `Bạn là Trợ lý AI thiết kế khảo sát (Survey Creator Assistant).
Nhiệm vụ của bạn là giúp người dùng xây dựng, chỉnh sửa và hoàn thiện form khảo sát hiện tại của họ thông qua cấu trúc JSON có định dạng rõ ràng.

Bạn có nhận thức đầy đủ về danh sách các câu hỏi hiện tại trong form thông qua dữ liệu ngữ cảnh dưới đây.

DANH SÁCH CÂU HỎI HIỆN TẠI TRONG FORM:
{current_questions}

CÂU HỎI ĐANG ĐƯỢC CHỌN (CONTEXTUAL ACTIVE QUESTION) - NẾU CÓ:
{active_question_info}

BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON SAU (CÁC GIÁ TRỊ TRONG NGOẶC VUÔNG LÀ MẪU CHỈ DẪN, HÃY THAY THẾ BẰNG NỘI DUNG THỰC TẾ CỦA BẠN):
{
  "action": {
    "name": "[Tên lệnh: add_questions / remove_question / suggest_question_type / update_questions / replace_questions / null]",
    "parameters": {
      // Cho lệnh add_questions:
      "questions_list": [
        {
          "text": "[Nội dung câu hỏi]",
          "type": "[Loại: radio / checkbox / text / voice / scale / dropdown / date / file]",
          "options": ["[Đáp án 1]", "[Đáp án 2]"],
          "is_branching_question": [true_hoặc_false],
          "condition_question_id": "[ID hoặc số câu trước để làm điều kiện hiển thị, ví dụ: q1]",
          "condition_value": "[Giá trị đáp án câu trước để kích hoạt câu này hiển thị]"
        }
      ],
      "position_after_question_id": "[ID câu trước hoặc null]"
      
      // Cho lệnh remove_question:
      "question_id": "[ID câu cần xóa]"
      
      // Cho lệnh suggest_question_type:
      "question_id": "[ID câu]",
      "suggested_type": "[Loại mới: radio / checkbox / text / voice / scale / dropdown / date / file]",
      "reason": "[Lý do đổi]"
      
      // Cho lệnh update_questions hoặc set_correct_answers (sửa câu hỏi hoặc ĐIỀN ĐÁP ÁN ĐÚNG/GIẢI THÍCH):
      "updates": [
        {
          "question_id": "[ID câu cần sửa, ví dụ: q1]",
          "text": "[Nội dung mới nếu muốn sửa, không thì bỏ qua]",
          "type": "[Loại mới nếu muốn sửa, không thì bỏ qua]",
          "options": ["[Mảng đáp án mới nếu muốn sửa, không thì bỏ qua]"],
          "correct_answer": "[Chuỗi đáp án đúng chuẩn nhất, ví dụ: 'Hà Nội' hoặc 'Đúng']",
          "explanation": "[Lời giải thích tại sao đáp án này đúng cho người học]",
          "difficulty": "[easy / medium / hard]",
          "topic": "[Chủ đề kiến thức]",
          "is_branching_question": [true_hoặc_false nếu muốn sửa],
          "condition_question_id": "[ID câu điều kiện, ví dụ: q1]",
          "condition_value": "[Giá trị đáp án câu trước kích hoạt câu này]"
        }
      ]

      // Cho lệnh replace_questions (XÓA CÁC CÂU CŨ VÀ THÊM CÂU MỚI PHÂN NHÁNH):
      "remove_ids": ["[Mảng các ID/số thứ tự câu cũ cần xóa, ví dụ: q41, q42]"],
      "questions_list": [
        {
          "text": "[Nội dung câu mới]",
          "type": "[Loại: radio / checkbox / text / voice / scale / dropdown / date / file]",
          "options": ["[Đáp án]"],
          "is_branching_question": [true_hoặc_false],
          "condition_question_id": "[ID câu điều kiện phân nhánh, ví dụ: q1]",
          "condition_value": "[Đáp án kích hoạt hiển thị câu này]"
        }
      ],
      "position_after_question_id": "[Chèn sau câu ID nào, ví dụ: q40]"
    }
  },
  "reply": "[Viết phản hồi thân thiện, ngắn gọn bằng tiếng Việt của bạn vào đây]"
}

QUY TẮC BẮT BUỘC:
1. Nếu người dùng chỉ hỏi đáp thông thường, giải thích kiến thức -> Đặt "action" là null.
2. Nếu người dùng yêu cầu sửa đổi form (thêm/xóa/đổi loại) -> Bạn PHẢI thiết lập "action" tương ứng với cấu trúc trên.
3. NGUYÊN TẮC LỰA CHỌN CÔNG CỤ (ADD VS UPDATE VS REPLACE):
   - PHÂN BIỆT RÕ THÊM MỚI, SỬA ĐỔI VÀ THAY THẾ:
     * Nếu các câu hỏi người dùng nêu ra CHƯA HỀ CÓ trên canvas (so khớp nội dung thấy không tồn tại trong "DANH SÁCH CÂU HỎI HIỆN TẠI TRONG FORM"), bạn PHẢI dùng lệnh "add_questions" để tạo mới.
     * Nếu người dùng yêu cầu phân nhánh, sửa đổi, rẽ nhánh cho các câu hỏi ĐÃ CÓ SẴN trên canvas, bạn NÊN sử dụng lệnh "replace_questions" để xóa các câu cũ đó (bằng cách điền các ID câu cũ vào "remove_ids") và thêm các câu mới được thiết lập phân nhánh hoàn chỉnh vào thế chỗ (trong "questions_list"). Đây là giải pháp tối ưu giúp làm sạch và cấu hình lại rẽ nhánh một cách hoàn hảo.
     * Ngoài ra, bạn cũng có thể dùng lệnh "update_questions" để cập nhật điều kiện phân nhánh ("condition_question_id", "condition_value") trực tiếp cho các câu đó nếu không muốn xóa.
   - NGUYÊN TẮC TRÍCH XUẤT HÀNG LOẠT:
     * Nếu thêm mới nhiều câu, bạn PHẢI trích xuất đầy đủ các câu đó vào "questions_list".
     * KHÔNG ĐƯỢC TỰ Ý CHIA NHỎ HÀNG LOẠT: Hãy luôn trả về đầy đủ tất cả câu hỏi được đưa ra trong danh sách yêu cầu của đợt này. Hệ thống phía trước đã tự động chia nhỏ và phân phối cho bạn theo từng đợt thích hợp, vì vậy nhiệm vụ của bạn là xử lý và trả về TOÀN BỘ danh sách câu hỏi được đưa ra trong prompt mà không được lược bớt hay bảo người dùng gõ 'tiếp tục'.
     * TUYỆT ĐỐI KHÔNG dùng dấu ba chấm (...) hoặc lược bớt danh sách câu hỏi trong trường "questions_list" hay "updates". Bạn PHẢI tự viết ra tất cả các câu hỏi đầy đủ mà người dùng cung cấp. Nếu bạn dùng dấu ba chấm (...) trong JSON, hệ thống sẽ gặp lỗi phân tích cú pháp nghiêm trọng và hành động sẽ bị hủy bỏ.
   - Không tự động ghép tên của cả nhóm phỏng vấn lớn (ví dụ: "PHỎNG VẤN NHÓM CỘNG ĐỒNG...", "PHỎNG VẤN CHUYÊN GIA...") lặp lại vào đầu của TỪNG câu hỏi. Hãy giữ tiêu đề câu hỏi ngắn gọn, chỉ ghi nội dung câu hỏi chính xác.
    - QUAN TRỌNG: Để tiết kiệm độ dài phản hồi và tránh trùng lặp, KHÔNG LIỆT KÊ chi tiết các câu hỏi trong trường "reply". Chỉ cần giải thích ngắn gọn trong "reply" (ví dụ: "Tôi đã tạo đề xuất thêm 25 câu hỏi phỏng vấn theo yêu cầu của bạn...") và đặt danh sách câu hỏi chi tiết vào trường "action" để hệ thống hiển thị thẻ Chấp nhận/Từ chối cho người dùng.
    - THIẾT LẬP PHÂN NHÁNH RẼ NHÁNH TỰ ĐỘNG:
      * Nếu các câu hỏi bạn đang thêm hoặc cập nhật thuộc về một nhóm phỏng vấn cụ thể (ví dụ: "Phỏng vấn nhóm cộng đồng", "Phỏng vấn chuyên gia mỹ thuật"), hãy dò tìm trong danh sách câu hỏi hiện tại xem có câu hỏi trắc nghiệm nào phân loại các nhóm này không (Ví dụ: Câu 1 hỏi "Anh/Chị thuộc nhóm đối tượng nào?").
      * Nếu tìm thấy, bạn PHẢI tự động thiết lập rẽ nhánh cho câu hỏi mới bằng cách điền vào "condition_question_id" (ID của câu phân loại đó, ví dụ: "q1" hoặc ID gốc) và "condition_value" (giá trị lựa chọn tương ứng, ví dụ: "Cộng đồng thực hành Lân Sư Rồng").
    - KHÔNG YÊU CẦU XÁC NHẬN BẰNG VĂN BẢN: Giao diện Chatbox đã có nút bấm "Chấp nhận" và "Từ chối" trực quan ngay trên thẻ hành động của Chatbox. Bạn chỉ cần trả về cấu trúc lệnh JSON hoàn chỉnh, tuyệt đối KHÔNG nói người dùng gõ "xác nhận", "đồng ý" hay tự hỏi xin xác nhận bằng văn bản.
    - QUY ĐỊNH VỀ VỊ TRÍ CHÈN CÂU HỎI (XEN GIỮA, CHÈN ĐẦU, CHÈN CUỐI):
       * Để chèn vào đầu khảo sát (đứng trước tất cả câu hỏi hiện tại): Đặt "position_after_question_id" thành "beginning".
       * Để chèn xen kẽ vào giữa hoặc thay thế đúng vị trí: Phân tích kỹ thứ tự số câu hỏi để tìm câu hỏi đứng ngay trước nó và đặt "position_after_question_id" là ID hoặc số câu của câu đứng trước đó (ví dụ: muốn chèn sau câu 9, đặt là "q9").
       * Để chèn vào cuối khảo sát: Đặt "position_after_question_id" là null.
    - NGUYÊN TẮC PHỤC HỒI TIN NHẮN SAO CHÉP:
      * Nếu người dùng gửi tin nhắn có dạng sao chép lại phản hồi của trợ lý (Ví dụ: "Tôi đã chỉnh sửa và thêm..."), nhưng bạn đối chiếu trong "DANH SÁCH CÂU HỎI HIỆN TẠI TRONG FORM" thấy chưa hề có các câu hỏi đó, nghĩa là hành động chưa được áp dụng thực tế. 
      * Bạn PHẢI lập tức gọi công cụ "add_questions" hoặc "update_questions" tương ứng để chèn/sửa danh sách câu hỏi này vào form, tuyệt đối không chỉ trả lời bằng văn bản suông xác nhận.
     - Nếu câu hỏi có biểu tượng micro 🎙 hoặc nói về "ghi âm", "giọng nói", "trả lời bằng lời" -> đặt loại câu hỏi là "voice".
     - Nếu câu hỏi đề cập đến "phỏng vấn video", "ghi hình", "camera", "quay phim" -> đặt loại câu hỏi là "video".
     - QUY TẮC SỬ DỤNG NGỮ CẢNH CÂU HỎI ĐANG ĐƯỢC CHỌN (CONTEXTUAL ACTIVE QUESTION):
       * Nếu có thông tin một câu cụ thể trong phần "CÂU HỎI ĐANG ĐƯỢC CHỌN (CONTEXTUAL ACTIVE QUESTION)" (không phải trống), mọi yêu cầu sửa đổi, chỉnh sửa nội dung hoặc thay đổi định dạng từ người dùng (ví dụ: "đổi sang voice", "sửa nội dung thành...", "thêm đáp án...") mà không chỉ rõ ID của câu hỏi khác, bạn PHẢI mặc định hiểu rằng yêu cầu đó dành riêng cho chính câu hỏi đang chọn này.
       * Bạn PHẢI tạo hành động "update_questions" hoặc "replace_questions" chỉ áp dụng cho chính ID của câu hỏi đang chọn đó (ví dụ: "updates": [{"question_id": "[ID của câu đang được chọn]", ...}]), TUYỆT ĐỐI không được chỉnh sửa hay tự ý áp dụng hành động cho tất cả các câu hỏi khác trên form.
4. Hãy viết câu trả lời bằng tiếng Việt lịch sự, trôi chảy, hỗ trợ tận tình.`;

function tryParseJSON(text: string) {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return JSON.parse(cleanText.trim());
  } catch (e) {
    // If fallback parsing fails, try to extract first JSON object
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(sliced);
      }
    } catch (innerErr) {
      console.error('Failed to extract JSON object:', innerErr);
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not defined' }, { status: 500 });
    }

    const { messages, currentQuestions, activeQuestionId } = await req.json();

    // Format current questions into readable text for the system prompt
    const formattedQuestions = (currentQuestions || []).map((q: any, idx: number) => {
      return `Câu ${idx + 1} (ID: "${q.id}", Loại: "${q.type}"): "${q.text}" [${(q.options || []).join(', ')}]`;
    }).join('\n');

    // Format active question if present
    let activeQuestionInfo = 'Không có câu hỏi nào đang được chọn.';
    if (activeQuestionId) {
      const activeQ = (currentQuestions || []).find((q: any) => q.id === activeQuestionId);
      if (activeQ) {
        const activeIdx = (currentQuestions || []).findIndex((q: any) => q.id === activeQuestionId);
        activeQuestionInfo = `Câu ${activeIdx + 1} (ID: "${activeQ.id}", Loại: "${activeQ.type}"): "${activeQ.text}"`;
      }
    }

    const systemPrompt = SYSTEM_PROMPT_CHAT
      .replace('{current_questions}', formattedQuestions || '(Danh sách câu hỏi đang trống)')
      .replace('{active_question_info}', activeQuestionInfo);

    // Build messages payload
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Fetch user profile tier to restrict models
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
        console.error('Error reading user tier in chat:', e);
      }
    }

    const activeModelChain = userTier === 'FREE'
      ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
      : MODEL_CHAIN;

    let lastError = null;
    let choice = null;

    for (const model of activeModelChain) {
      try {
        console.log(`[AI Chat Router] Sending JSON completion request to OpenRouter with model ${model}...`);
        const response = await client.chat.completions.create({
          model,
          messages: apiMessages,
          max_tokens: 3500
        });

        const choiceMsg = response.choices[0]?.message;
        if (choiceMsg && choiceMsg.content) {
          choice = choiceMsg;
          console.log(`[AI Chat Router] Success response with model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ Warning using model ${model}:`, err.message);
      }
    }

    if (!choice) {
      throw new Error(`Tất cả các model AI free đều lỗi hoặc hết quota: ${lastError?.message || 'Unknown error'}`);
    }

    const rawContent = choice.content || '';
    const parsed = tryParseJSON(rawContent);

    let tool_calls: any[] = [];
    let replyText = '';

    if (parsed) {
      replyText = parsed.reply || '';
      if (parsed.action && parsed.action.name) {
        tool_calls = [
          {
            id: `tc-json-${Date.now()}`,
            type: 'function',
            function: {
              name: parsed.action.name,
              arguments: JSON.stringify(parsed.action.parameters || {})
            }
          }
        ];
        console.log(`[AI Chat Router] Extracted action "${parsed.action.name}" from JSON response.`);
      }
    } else {
      console.warn('[AI Chat Router] Standard JSON parse failed. Running regex-based fallback extraction...');

      // Extract reply string
      const replyRegex = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/;
      const replyMatch = rawContent.match(replyRegex);
      replyText = replyMatch ? replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';

      // Find action name
      const actionNameRegex = /"name"\s*:\s*"([a-zA-Z_]+)"/;
      const actionNameMatch = rawContent.match(actionNameRegex);
      const actionName = actionNameMatch ? actionNameMatch[1] : null;

      if (actionName === 'add_questions') {
        const questionsList: any[] = [];

        // Find the index of "questions_list" to search within the list block scope
        const listStartIdx = rawContent.indexOf('questions_list');
        const searchScope = listStartIdx !== -1 ? rawContent.substring(listStartIdx) : rawContent;

        // Match anything inside braces { ... }
        const braceRegex = /\{([^{}]+)\}/g;
        let braceMatch;
        while ((braceMatch = braceRegex.exec(searchScope)) !== null) {
          const blockText = braceMatch[1];

          // Match text and type fields independently (case-insensitive and order-independent)
          const textMatch = blockText.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
          const typeMatch = blockText.match(/"type"\s*:\s*"([a-zA-Z_]+)"/i);

          if (textMatch && typeMatch) {
            const qText = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            const qType = typeMatch[1].toLowerCase();

            // Extract options if present
            let options: string[] = [];
            const optionsBlock = blockText.match(/"options"\s*:\s*\[([^\]]*)\]/i);
            if (optionsBlock) {
              options = optionsBlock[1]
                .split(',')
                .map(o => o.trim().replace(/^["']|["']$/g, ''))
                .filter(o => o.length > 0);
            }

            // Extract branching properties if present
            const isBranchingMatch = blockText.match(/"is_branching_question"\s*:\s*(true|false)/i);
            const is_branching_question = isBranchingMatch ? isBranchingMatch[1].toLowerCase() === 'true' : false;

            const condIdMatch = blockText.match(/"condition_question_id"\s*:\s*"([^"]*)"/i);
            const condition_question_id = condIdMatch ? condIdMatch[1] : null;

            const condValMatch = blockText.match(/"condition_value"\s*:\s*"([^"]*)"/i);
            const condition_value = condValMatch ? condValMatch[1] : null;

            questionsList.push({
              text: qText,
              type: qType,
              options,
              is_branching_question,
              condition_question_id,
              condition_value
            });
          }
        }

        if (questionsList.length > 0) {
          tool_calls = [
            {
              id: `tc-fallback-${Date.now()}`,
              type: 'function',
              function: {
                name: 'add_questions',
                arguments: JSON.stringify({ questions_list: questionsList })
              }
            }
          ];
          console.log(`[AI Chat Router] Resilient regex successfully extracted ${questionsList.length} questions.`);
        }
      } else if (actionName === 'remove_question') {
        const questionIdRegex = /"question_id"\s*:\s*"([^"]+)"/;
        const questionIdMatch = rawContent.match(questionIdRegex);
        if (questionIdMatch) {
          tool_calls = [
            {
              id: `tc-fallback-${Date.now()}`,
              type: 'function',
              function: {
                name: 'remove_question',
                arguments: JSON.stringify({ question_id: questionIdMatch[1] })
              }
            }
          ];
        }
      } else if (actionName === 'suggest_question_type') {
        const questionIdRegex = /"question_id"\s*:\s*"([^"]+)"/;
        const questionIdMatch = rawContent.match(questionIdRegex);
        const suggestedTypeRegex = /"suggested_type"\s*:\s*"([^"]+)"/;
        const suggestedTypeMatch = rawContent.match(suggestedTypeRegex);
        if (questionIdMatch && suggestedTypeMatch) {
          tool_calls = [
            {
              id: `tc-fallback-${Date.now()}`,
              type: 'function',
              function: {
                name: 'suggest_question_type',
                arguments: JSON.stringify({
                  question_id: questionIdMatch[1],
                  suggested_type: suggestedTypeMatch[1]
                })
              }
            }
          ];
        }
      } else if (actionName === 'update_questions') {
        const updatesList: any[] = [];
        const updatesStartIdx = rawContent.indexOf('updates');
        const searchScope = updatesStartIdx !== -1 ? rawContent.substring(updatesStartIdx) : rawContent;

        const braceRegex = /\{([^{}]+)\}/g;
        let braceMatch;
        while ((braceMatch = braceRegex.exec(searchScope)) !== null) {
          const blockText = braceMatch[1];
          const idMatch = blockText.match(/"question_id"\s*:\s*"([^"]*)"/i);

          if (idMatch) {
            const qId = idMatch[1];
            const textMatch = blockText.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            const typeMatch = blockText.match(/"type"\s*:\s*"([a-zA-Z_]+)"/i);

            let options: string[] = [];
            const optionsBlock = blockText.match(/"options"\s*:\s*\[([^\]]*)\]/i);
            if (optionsBlock) {
              options = optionsBlock[1]
                .split(',')
                .map(o => o.trim().replace(/^["']|["']$/g, ''))
                .filter(o => o.length > 0);
            }

            const isBranchingMatch = blockText.match(/"is_branching_question"\s*:\s*(true|false)/i);
            const is_branching_question = isBranchingMatch ? isBranchingMatch[1].toLowerCase() === 'true' : undefined;

            const condIdMatch = blockText.match(/"condition_question_id"\s*:\s*"([^"]*)"/i);
            const condition_question_id = condIdMatch ? condIdMatch[1] : undefined;

            const condValMatch = blockText.match(/"condition_value"\s*:\s*"([^"]*)"/i);
            const condition_value = condValMatch ? condValMatch[1] : undefined;

            updatesList.push({
              question_id: qId,
              text: textMatch ? textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : undefined,
              type: typeMatch ? typeMatch[1].toLowerCase() : undefined,
              options: options.length > 0 ? options : undefined,
              is_branching_question,
              condition_question_id,
              condition_value
            });
          }
        }

        if (updatesList.length > 0) {
          tool_calls = [
            {
              id: `tc-fallback-${Date.now()}`,
              type: 'function',
              function: {
                name: 'update_questions',
                arguments: JSON.stringify({ updates: updatesList })
              }
            }
          ];
          console.log(`[AI Chat Router] Regex successfully extracted ${updatesList.length} updates.`);
        }
      } else if (actionName === 'replace_questions') {
        const removeIds: string[] = [];
        const questionsList: any[] = [];

        // Extract remove_ids array
        const removeIdsBlock = rawContent.match(/"remove_ids"\s*:\s*\[([^\]]*)\]/i);
        if (removeIdsBlock) {
          removeIdsBlock[1]
            .split(',')
            .map(id => id.trim().replace(/^["']|["']$/g, ''))
            .filter(id => id.length > 0)
            .forEach(id => removeIds.push(id));
        }

        // Extract questions_list array
        const listStartIdx = rawContent.indexOf('questions_list');
        const searchScope = listStartIdx !== -1 ? rawContent.substring(listStartIdx) : rawContent;

        const braceRegex = /\{([^{}]+)\}/g;
        let braceMatch;
        while ((braceMatch = braceRegex.exec(searchScope)) !== null) {
          const blockText = braceMatch[1];
          const textMatch = blockText.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
          const typeMatch = blockText.match(/"type"\s*:\s*"([a-zA-Z_]+)"/i);

          if (textMatch && typeMatch) {
            const qText = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            const qType = typeMatch[1].toLowerCase();

            let options: string[] = [];
            const optionsBlock = blockText.match(/"options"\s*:\s*\[([^\]]*)\]/i);
            if (optionsBlock) {
              options = optionsBlock[1]
                .split(',')
                .map(o => o.trim().replace(/^["']|["']$/g, ''))
                .filter(o => o.length > 0);
            }

            const isBranchingMatch = blockText.match(/"is_branching_question"\s*:\s*(true|false)/i);
            const is_branching_question = isBranchingMatch ? isBranchingMatch[1].toLowerCase() === 'true' : false;

            const condIdMatch = blockText.match(/"condition_question_id"\s*:\s*"([^"]*)"/i);
            const condition_question_id = condIdMatch ? condIdMatch[1] : null;

            const condValMatch = blockText.match(/"condition_value"\s*:\s*"([^"]*)"/i);
            const condition_value = condValMatch ? condValMatch[1] : null;

            questionsList.push({
              text: qText,
              type: qType,
              options,
              is_branching_question,
              condition_question_id,
              condition_value
            });
          }
        }

        const posAfterRegex = /"position_after_question_id"\s*:\s*"([^"]*)"/;
        const posAfterMatch = rawContent.match(posAfterRegex);
        const position_after_question_id = posAfterMatch ? posAfterMatch[1] : null;

        if (removeIds.length > 0 || questionsList.length > 0) {
          tool_calls = [
            {
              id: `tc-fallback-${Date.now()}`,
              type: 'function',
              function: {
                name: 'replace_questions',
                arguments: JSON.stringify({
                  remove_ids: removeIds,
                  questions_list: questionsList,
                  position_after_question_id
                })
              }
            }
          ];
          console.log(`[AI Chat Router] Regex successfully extracted replacement of ${removeIds.length} questions with ${questionsList.length} new ones.`);
        }
      }

      // If regex extraction failed to find any reply, clean markdown wrapper or fallback to raw content
      if (!replyText.trim()) {
        replyText = rawContent.replace(/\{[\s\S]*\}/g, '').trim();
        if (!replyText.trim()) {
          replyText = rawContent;
        }
      }
    }

    if (!replyText.trim() && tool_calls.length === 0) {
      replyText = "Xin lỗi bạn, mô hình AI hiện tại đang phản hồi chậm hoặc trả về dữ liệu trống. Bạn vui lòng thử lại yêu cầu ngắn gọn hơn hoặc gửi lại tin nhắn nhé!";
    }

    return NextResponse.json({
      role: 'assistant',
      content: replyText,
      tool_calls
    });

  } catch (err: any) {
    console.error('[AI Chat Error]:', err);
    return NextResponse.json({ error: err.message || 'Lỗi hệ thống AI' }, { status: 500 });
  }
}
