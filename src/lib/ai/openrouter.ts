import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: (process.env.OPENROUTER_API_KEY || '').trim().replace(/(^"|"$|'$)/g, '').trim(),
  baseURL: 'https://api.navy/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/google/antigravity',
    'X-Title': 'Website Survey AI',
  }
});

// A comprehensive fallback chain of active free models on OpenRouter
const MODEL_CHAIN = [
  'gpt-5.4-nano',
  'gemini-2.5-flash-lite',
  'gpt-5-mini',
  'gpt-5-nano'
];

const SYSTEM_PROMPT_SCHEMA = `Bạn là hệ thống chuyển đổi văn bản thành cấu trúc form khảo sát thông minh.

NHIỆM VỤ: Phân tích nội dung văn bản người dùng cung cấp, tự động phát hiện và phân biệt:
- Các câu hỏi và đáp án thông thường.
- Các logic điều kiện phân nhánh rẽ nhánh (Ví dụ: "Nếu chọn A thì hiện câu hỏi B", "chỉ hiện khi Câu 1 chọn Xe máy", "Khi trả lời là Đúng, hỏi tiếp...", v.v.).

QUY TẮC BẮT BUỘC:
1. Chỉ trả về JSON hợp lệ, không thêm giải thích, không thêm markdown \`\`\`.
2. Loại câu hỏi hợp lệ: "radio", "checkbox", "text", "voice", "scale", "dropdown", "date", "file"
3. Bắt buộc tạo trường "ai_summary" ở cấp cao nhất để tóm tắt các thiết lập bạn đã thực hiện (số câu hỏi, luồng phân nhánh rẽ sang đâu, và lý do thiết kế).
4. Phân biệt câu hỏi điều kiện phân nhánh:
   - Bất kỳ câu hỏi trắc nghiệm nào có đáp án quyết định việc ẩn/hiện câu hỏi khác thì câu hỏi đó phải được đánh dấu "is_branching": true.
   - Các câu hỏi phụ thuộc (chỉ hiện khi thỏa mãn điều kiện) phải chứa thuộc tính "visibility" trỏ đến câu hỏi quyết định:
     "visibility": {
       "condition_question_id": "ID_CỦA_CÂU_HỎI_ĐIỀU_KIỆN_TRƯỚC_ĐÓ",
       "condition_value": "GIÁ_TRỊ_ĐÁP_ÁN_ĐỂ_KÍCH_HOẠT"
     }
5. Nếu văn bản có dấu * sau đáp án -> đó là correct_answer.
6. Giữ nguyên ngôn ngữ gốc của câu hỏi.
7. Các ID của câu hỏi phải là định dạng chuỗi đơn giản như: "q1", "q2", "q3"... để dễ liên kết phân nhánh.

Ví dụ trả về:
{
  "form_title": "Khảo sát mức độ hài lòng",
  "ai_summary": "Khảo sát gồm 3 câu hỏi. Câu 1 dùng để phân loại đối tượng khách hàng (ăn tại chỗ hoặc mang đi) và đóng vai trò điểm mốc phân nhánh. Câu 3 chỉ hiển thị đối với những khách hàng chọn ăn tại chỗ để lấy thêm đánh giá dịch vụ bàn.",
  "questions": [
    {
      "id": "q1",
      "type": "radio",
      "text": "Bạn sử dụng dịch vụ theo hình thức nào?",
      "options": ["Ăn tại chỗ", "Mua mang đi"],
      "is_branching": true,
      "correct_answer": null
    },
    {
      "id": "q2",
      "type": "text",
      "text": "Họ và tên của bạn",
      "options": [],
      "is_branching": false,
      "correct_answer": null
    },
    {
      "id": "q3",
      "type": "voice",
      "text": "Hãy đánh giá chất lượng phục vụ tại bàn của chúng tôi",
      "options": [],
      "is_branching": false,
      "correct_answer": null,
      "visibility": {
        "condition_question_id": "q1",
        "condition_value": "Ăn tại chỗ"
      }
    }
  ]
}`;

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
    console.error('Failed to parse JSON content from AI response:', text, e);
    return null;
  }
}

function preprocessText(text: string): string {
  if (!text) return '';

  // Collapse duplicate spaces and collapse multiple newlines to double newlines
  let cleaned = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  // Truncate excessively long text (above 10k chars) to avoid exceeding token-per-minute (TPM) limits on free models
  const MAX_CHARS = 10000;
  if (cleaned.length > MAX_CHARS) {
    console.log(`[AI Preprocessor] Text length (${cleaned.length}) exceeds safety limit. Truncating to ${MAX_CHARS} chars.`);
    cleaned = cleaned.substring(0, MAX_CHARS) + '\n\n[...Nội dung còn lại đã được cắt bớt để ngăn ngừa quá tải giới hạn token AI...]';
  }

  return cleaned;
}

export async function generateFormFromText(text: string, tier = 'FREE'): Promise<{ data: any; usedModel: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not defined in environment variables.');
  }

  const activeModelChain = tier === 'FREE'
    ? ['gemini-2.5-flash-lite', 'gpt-5-nano']
    : MODEL_CHAIN;

  interface DetectedQuestion {
    id: string;
    originalText: string;
    group: string | null;
  }

  // 1. Scan and detect all questions locally to build a manifest
  const detectQuestionsInDocument = (rawText: string): DetectedQuestion[] => {
    const lines = rawText.split('\n');
    const detected: DetectedQuestion[] = [];
    let currentGroup: string | null = null;
    let activeId: string | null = null;
    let activeLines: string[] = [];

    const isGroupTitle = (line: string): boolean => {
      const clean = line.replace(/[\*\#]/g, '').trim();
      if (clean.length < 5) return false;
      const isIndicator = /^(?:PHỎNG VẤN|NHÓM|PHẦN|MỤC|GROUP|SECTION|INTRO)/i.test(clean);
      const letters = clean.replace(/[^a-zA-ZĂâêôơưđĂÂÊÔƠƯĐ]/g, '');
      const isAllCaps = letters.length > 0 && letters === letters.toUpperCase();
      return isIndicator || isAllCaps;
    };

    const parseHeader = (line: string): { id: string } | null => {
      const cleanLine = line.replace(/^\s*[\-\*\+•]\s*/, '').trim().replace(/\.+$/, '').trim();

      // Pattern 1: Standard prefix/numbered headers (e.g. "Câu 1:", "4. ")
      const headerRegex = /^(?:(Câu\s*hỏi|Câu|Question|Q|QT|TH|DS|TK|CT|P|INT|C)\s*(\d+)|(\d+))\s*[:\.\-\)\s]/i;
      const match = cleanLine.match(headerRegex);
      if (match) {
        if (match[1] && match[2]) {
          return { id: `${match[1]}${match[2]}` };
        } else if (match[3]) {
          return { id: `C${match[3]}` };
        }
      }

      // Pattern 2: Unnumbered questions ending with '?' (excluding section/group titles)
      const questionMarkRegex = /^[^#\n]+?\?\s*(?:\([^)]+\))?\s*$/;
      if (questionMarkRegex.test(cleanLine)) {
        return { id: 'C_unkn' };
      }
      return null;
    };

    let unknCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) continue;

      if (isGroupTitle(trimmedLine)) {
        if (activeId && activeLines.length > 0) {
          detected.push({
            id: activeId,
            originalText: activeLines.join('\n'),
            group: currentGroup
          });
          activeId = null;
          activeLines = [];
        }
        currentGroup = trimmedLine.replace(/[\*\#]/g, '').trim();
        continue;
      }

      const header = parseHeader(trimmedLine);
      if (header) {
        if (activeId && activeLines.length > 0) {
          detected.push({
            id: activeId,
            originalText: activeLines.join('\n'),
            group: currentGroup
          });
        }
        activeId = header.id === 'C_unkn' ? `C_unkn_${unknCounter++}` : header.id;
        activeLines = [rawLine];
      } else {
        if (activeId) {
          activeLines.push(rawLine);
        }
      }
    }

    if (activeId && activeLines.length > 0) {
      detected.push({
        id: activeId,
        originalText: activeLines.join('\n'),
        group: currentGroup
      });
    }

    return detected;
  };

  const parseOptionsLocally = (rawText: string): string[] => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const options: string[] = [];
    lines.forEach(line => {
      const cleanLine = line.replace(/^\s*[\-\*\+•]\s*/, '').trim();
      if (line.startsWith('-') || line.startsWith('*') || line.startsWith('+') || line.startsWith('•')) {
        options.push(cleanLine);
      } else {
        const optionLetterRegex = /^[a-zĐ]\s*[\.\)\-]\s+(.+)/i;
        const match = cleanLine.match(optionLetterRegex);
        if (match) {
          options.push(match[1].trim());
        }
      }
    });
    return options;
  };

  let detected = detectQuestionsInDocument(text);
  if (detected.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let activeLines: string[] = [];
    let qIdx = 1;
    lines.forEach(line => {
      if (line.startsWith('-') || line.startsWith('*') || line.startsWith('+') || line.startsWith('•')) {
        activeLines.push(line);
      } else {
        if (activeLines.length > 0) {
          detected.push({
            id: `C${qIdx++}`,
            originalText: activeLines.join('\n'),
            group: null
          });
        }
        activeLines = [line];
      }
    });
    if (activeLines.length > 0) {
      detected.push({
        id: `C${qIdx}`,
        originalText: activeLines.join('\n'),
        group: null
      });
    }
  }

  // 2. Group complete questions into structure chunks
  const chunks: { id: string; questions: DetectedQuestion[] }[] = [];
  let currentChunkQs: DetectedQuestion[] = [];
  let currentChunkLength = 0;
  const CHAR_BUDGET = 3500;
  let chunkIndex = 1;

  detected.forEach(q => {
    const qLength = q.originalText.length;
    if (currentChunkLength + qLength > CHAR_BUDGET && currentChunkQs.length > 0) {
      chunks.push({
        id: `chunk_${String(chunkIndex++).padStart(3, '0')}`,
        questions: currentChunkQs
      });
      currentChunkQs = [q];
      currentChunkLength = qLength;
    } else {
      currentChunkQs.push(q);
      currentChunkLength += qLength;
    }
  });
  if (currentChunkQs.length > 0) {
    chunks.push({
      id: `chunk_${String(chunkIndex).padStart(3, '0')}`,
      questions: currentChunkQs
    });
  }

  // 3. Sequential AI processing with manifest tracking
  const processedQuestions: { [id: string]: any } = {};
  let usedModel = activeModelChain[0];
  let lastError = null;

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const expectedIds = chunk.questions.map(q => q.id);
    const chunkText = chunk.questions.map(q => `[EXPECTED ID: ${q.id}] [Thuộc nhóm: ${q.group || 'Không'}]\nNội dung:\n${q.originalText}`).join('\n\n');

    const chunkPrompt = `Nhiệm vụ: Phân tích danh sách câu hỏi phỏng vấn dưới đây và trả về cấu trúc JSON chứa đầy đủ các câu hỏi này.

DANH SÁCH CÂU HỎI:
${chunkText}

CÁC ID CÂU HỎI BẮT BUỘC TRẢ VỀ (Hãy giữ nguyên định dạng ID chính xác):
${expectedIds.join(', ')}

QUY TẮC BẮT BUỘC:
1. Bạn phải trả về cấu trúc JSON hành động "add_questions" chứa mảng "questions_list" với chính xác các câu hỏi có ID ở trên.
2. Không tự ý bỏ sót bất kỳ câu hỏi nào.
3. Định dạng câu hỏi compact:
{
  "id": "${expectedIds[0]}",
  "text": "[Nội dung câu hỏi, loại bỏ phần ID ở đầu]",
  "type": "[Loại: radio / checkbox / text / voice / scale / dropdown / date / file]",
  "options": ["[Mảng lựa chọn]"],
  "is_branching_question": [true/false],
  "condition_question_id": "[ID câu trước nếu có]",
  "condition_value": "[Đáp án câu trước nếu có]"
}
4. KHÔNG viết phân tích hay giải thích ngoài JSON.`;

    let chunkQuestions: any[] = [];
    let success = false;

    for (const model of activeModelChain) {
      let retries = 3;
      let delay = 4000;

      while (retries > 0 && !success) {
        try {
          console.log(`[Generate API] Calling model ${model} for chunk ${chunk.id} (retries left: ${retries}, input length: ${chunkPrompt.length} chars)`);
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: 'Bạn là Trợ lý AI thiết kế khảo sát. Hãy trả về JSON chứa mảng questions_list.' },
              { role: 'user', content: chunkPrompt }
            ]
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            const parsed = tryParseJSON(content);
            const list = parsed?.questions_list || parsed?.action?.parameters?.questions_list || parsed?.questions;
            if (Array.isArray(list)) {
              chunkQuestions = list;
              success = true;
              usedModel = model;
            }
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[Generate API] Warning using model ${model} for chunk ${chunk.id}:`, err.message);
          const isRateLimit = err.status === 429 || err.message.includes('429') || err.message.includes('rate');
          if (isRateLimit) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            break;
          }
        }
        retries--;
      }
      if (success) break;
    }

    // Output Validation
    const returnedMap: { [id: string]: any } = {};
    chunkQuestions.forEach(q => {
      const cleanId = String(q.id || '').trim();
      const matchedId = expectedIds.find(id => id.toLowerCase() === cleanId.toLowerCase());
      if (matchedId) {
        returnedMap[matchedId] = q;
      }
    });

    const missingIds = expectedIds.filter(id => !returnedMap[id]);

    expectedIds.forEach(id => {
      if (returnedMap[id]) {
        processedQuestions[id] = returnedMap[id];
      }
    });

    // Recovery Queue: reprocess missing questions individually
    if (missingIds.length > 0) {
      console.log(`[Generate API] Chunk ${chunk.id} missing ${missingIds.length} questions. Running recovery...`);
      for (const missingId of missingIds) {
        const originalQ = chunk.questions.find(q => q.id === missingId)!;
        let recoveredQ = null;
        let recSuccess = false;

        const singlePrompt = `Nhiệm vụ: Trích xuất thông tin câu hỏi khảo sát dưới đây thành cấu trúc JSON.
CÂU HỎI (ID: ${missingId}):
${originalQ.originalText}

Trả về JSON hành động "add_questions" chứa mảng "questions_list" gồm duy nhất câu hỏi có ID là "${missingId}".`;

        for (const model of MODEL_CHAIN) {
          let recRetries = 2;
          while (recRetries > 0 && !recSuccess) {
            try {
              const response = await client.chat.completions.create({
                model,
                messages: [
                  { role: 'system', content: 'Bạn là Trợ lý AI thiết kế khảo sát. Hãy trả về JSON chứa mảng questions_list.' },
                  { role: 'user', content: singlePrompt }
                ]
              });
              const content = response.choices[0]?.message?.content;
              if (content) {
                const parsed = tryParseJSON(content);
                const list = parsed?.questions_list || parsed?.action?.parameters?.questions_list || parsed?.questions;
                if (Array.isArray(list) && list.length > 0) {
                  recoveredQ = list[0];
                  recSuccess = true;
                }
              }
            } catch (err) {
              console.warn(`[Generate API Recovery] Failed with model ${model}:`, err);
            }
            recRetries--;
          }
          if (recSuccess) break;
        }

        if (recSuccess && recoveredQ) {
          processedQuestions[missingId] = recoveredQ;
        }
      }
    }

    if (chunkIdx < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 4. Final Merge & Standard Formatting
  const finalQuestions: any[] = [];
  detected.forEach((q, idx) => {
    const originalId = q.id;
    const cleanNumId = `q${idx + 1}`; // Standardize output IDs to q1, q2...

    if (processedQuestions[originalId]) {
      const extracted = processedQuestions[originalId];
      let options = extracted.options || [];
      const localOptions = parseOptionsLocally(q.originalText);
      if ((!options || options.length === 0) && localOptions.length > 0) {
        options = localOptions;
      }

      finalQuestions.push({
        id: cleanNumId,
        type: extracted.type || (options.length > 0 ? 'radio' : 'text'),
        text: extracted.text || q.originalText.replace(/^\s*[\-\*\+•]?\s*(?:(?:Câu\s*hỏi|Câu|Question|Q|QT|TH|DS|TK|CT|P|INT|C)\s*\d+|[\d]+)\s*[:\.\-\)\s]/i, '').trim(),
        options: options,
        is_branching: extracted.is_branching_question || false,
        correct_answer: null,
        visibility: extracted.condition_question_id ? {
          condition_question_id: extracted.condition_question_id, // Will re-map to standardized IDs in next pass
          condition_value: extracted.condition_value
        } : null,
        _tempOriginalId: originalId
      });
    } else {
      const localOptions = parseOptionsLocally(q.originalText);
      finalQuestions.push({
        id: cleanNumId,
        type: localOptions.length > 0 ? 'radio' : 'text',
        text: q.originalText.replace(/^\s*[\-\*\+•]?\s*(?:(?:Câu\s*hỏi|Câu|Question|Q|QT|TH|DS|TK|CT|P|INT|C)\s*\d+|[\d]+)\s*[:\.\-\)\s]/i, '').trim(),
        options: localOptions,
        is_branching: false,
        correct_answer: null,
        visibility: null,
        _tempOriginalId: originalId
      });
    }
  });

  // Resolve condition_question_id references to the standardized 'q1', 'q2' IDs
  finalQuestions.forEach(fq => {
    if (fq.visibility && fq.visibility.condition_question_id) {
      const targetOriginalId = String(fq.visibility.condition_question_id).trim().toLowerCase();
      const matched = finalQuestions.find(k => String((fq as any)._tempOriginalId).trim().toLowerCase() === targetOriginalId || String((k as any)._tempOriginalId).trim().toLowerCase() === targetOriginalId);
      if (matched) {
        fq.visibility.condition_question_id = matched.id;
      } else {
        fq.visibility = null;
      }
    }
    delete (fq as any)._tempOriginalId;
  });

  let resultQuestions = finalQuestions;
  if (tier === 'FREE' && resultQuestions.length > 20) {
    console.log(`[AI Generator] FREE tier question limit (20) reached. Truncating from ${resultQuestions.length} questions.`);
    resultQuestions = resultQuestions.slice(0, 20);
  }

  const finalSurvey = {
    form_title: 'Khảo sát văn bản đã import',
    ai_summary: `Khảo sát được tạo tự động chứa ${resultQuestions.length} câu hỏi phỏng vấn được bóc tách và phân lớp cấu trúc hoàn tất.${finalQuestions.length > 20 && tier === 'FREE' ? ' (Đã giới hạn còn tối đa 20 câu hỏi do tài khoản ở gói Miễn phí)' : ''}`,
    questions: resultQuestions
  };

  return { data: finalSurvey, usedModel };
}

export async function analyzeResponsesWithAI(formTitle: string, questionText: string, answers: string[]): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not defined in environment variables.');
  }

  const prompt = `Phân tích các câu trả lời của câu hỏi khảo sát sau đây:
Tên Form: "${formTitle}"
Câu hỏi: "${questionText}"
Câu trả lời:
${answers.map((ans, idx) => `${idx + 1}. ${ans}`).join('\n')}

Hãy thực hiện:
1. Tóm tắt các ý kiến, xu hướng chung.
2. Phân loại cảm xúc (Tỷ lệ % Tích cực, Tiêu cực, Trung lập).
3. Gom nhóm các câu trả lời tương tự nhau (Group by topic/theme).
4. Trích xuất insight nổi bật.

Hãy trả về kết quả dưới dạng JSON có cấu trúc như sau, không có markdown hay text giải thích thừa:
{
  "summary": "Tóm tắt xu hướng chung...",
  "sentiment": {
    "positive": 60,
    "negative": 20,
    "neutral": 20
  },
  "topics": [
    { "name": "Chủ đề A (ví dụ: Giá cả)", "percentage": 40, "description": "Nhiều người nói về giá..." },
    { "name": "Chủ đề B (ví dụ: Chất lượng)", "percentage": 30, "description": "Ý kiến về sản phẩm tốt..." }
  ],
  "insights": [
    "Insight nổi bật 1...",
    "Insight nổi bật 2..."
  ]
}`;

  for (const model of MODEL_CHAIN) {
    let retries = 2;
    let delay = 3000;

    while (retries > 0) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia phân tích dữ liệu khảo sát và phản hồi khách hàng. Chỉ trả về JSON hợp lệ.' },
            { role: 'user', content: prompt }
          ]
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = tryParseJSON(content);
          if (parsed) {
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`Error analyzing responses with model ${model}:`, err.message);
        const isRateLimit = err.status === 429 || err.message.includes('429');
        if (isRateLimit) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          break;
        }
        retries--;
      }
    }
  }

  throw new Error('Tất cả các model AI free đều lỗi khi phân tích kết quả.');
}
