'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, Send, X, Plus, Check, Loader2, AlertCircle, HelpCircle, Edit } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

interface Question {
  id: string;
  type: string;
  text: string;
  options: string[];
  correct_answer?: string | null;
  is_required: boolean;
  is_branching_question: boolean;
  visibility_type: 'always' | 'conditional';
  condition_question_id?: string | null;
  condition_value?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: any[];
  // Status to track interactive actions (e.g. pending confirmation, accepted, rejected)
  actionStatus?: { [toolCallId: string]: 'pending' | 'accepted' | 'rejected' };
}

interface AiChatboxProps {
  formId: string;
  questions: Question[];
  selectedQuestionId: string | null;
  onQuestionsChange: (updatedQuestions: Question[]) => void;
  onSelectQuestion: (id: string | null) => void;
  isQuiz?: boolean;
}

export default function AiChatbox({
  formId,
  questions,
  selectedQuestionId,
  onQuestionsChange,
  onSelectQuestion,
  isQuiz = false
}: AiChatboxProps) {
  const { toast } = useToast();
  
  // UI States
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [isGlobalMode, setIsGlobalMode] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(`survey_chat_${formId}`);
    if (cached) {
      try {
        setMessages(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse cached chat history", e);
      }
    } else {
      // Default welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Xin chào! Tôi là Trợ lý AI thiết kế khảo sát. Bạn có thể yêu cầu tôi thêm câu hỏi mới, xóa câu hỏi, gợi ý loại câu hỏi phù hợp, hoặc hướng dẫn cách cấu hình phân nhánh. Hãy gõ nội dung cần thực hiện bên dưới!'
        }
      ]);
    }

    // Check if user dismissed tooltip previously
    const tooltipDismissed = localStorage.getItem(`survey_chat_tooltip_dismissed`);
    if (tooltipDismissed === 'true') {
      setShowTooltip(false);
    }
  }, [formId]);

  // Sync messages to localStorage
  const saveMessages = (newMsgs: Message[]) => {
    setMessages(newMsgs);
    localStorage.setItem(`survey_chat_${formId}`, JSON.stringify(newMsgs));
  };

  // Scroll to bottom on message updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Automatically switch chat mode when contextual question selection changes
  useEffect(() => {
    if (selectedQuestionId) {
      setIsGlobalMode(false);
    } else {
      setIsGlobalMode(true);
    }
  }, [selectedQuestionId]);

  // Handle tooltip dismissal
  const handleDismissTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(false);
    localStorage.setItem(`survey_chat_tooltip_dismissed`, 'true');
  };

  // Send Message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isSending) return;

    const userText = inputValue.trim();
    setInputValue('');

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText
    };

    const updatedMessages = [...messages, newMsg];
    saveMessages(updatedMessages);
    setIsSending(true);
    setProgressText('Đang phân tích tin nhắn...');

    try {
      // 1. Client-side robust regex-based question splitter
      interface DetectedQuestion {
        id: string;
        originalText: string;
        group: string | null;
      }

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

      let detected = detectQuestionsInDocument(userText);
      if (detected.length === 0) {
        const lines = userText.split('\n').map(l => l.trim()).filter(Boolean);
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

      // If we detected a long list of questions (>= 4 questions), trigger chunked processing!
      if (detected.length >= 4) {
        setProgressText(`Phát hiện ${detected.length} câu hỏi. Đang chuẩn bị phân tích...`);
        
        // Match range in userText (e.g. "41-65", "41 đến 65")
        const rangeRegex = /(\d+)\s*(?:-|đến|->|to)\s*(\d+)/i;
        const rangeMatch = userText.match(rangeRegex);
        const removeIds: string[] = [];
        let insertPositionId: string | null = null;

        if (rangeMatch) {
          const startNum = parseInt(rangeMatch[1], 10);
          const endNum = parseInt(rangeMatch[2], 10);
          if (startNum > 0 && endNum >= startNum && endNum <= 150) {
            // Collect question IDs to remove
            for (let i = startNum - 1; i < endNum; i++) {
              if (questions[i]) {
                removeIds.push(questions[i].id);
              }
            }
            // Set insertion position just before the first deleted question
            if (startNum === 1) {
              insertPositionId = 'beginning';
            } else if (startNum >= 2 && questions[startNum - 2]) {
              insertPositionId = questions[startNum - 2].id;
            }
          }
        } else {
          // If no range matched, parse the number from the first detected question ID
          const firstQId = detected[0]?.id;
          const matchDigit = firstQId?.match(/\d+/);
          if (matchDigit) {
            const firstNum = parseInt(matchDigit[0], 10);
            if (firstNum === 1) {
              insertPositionId = 'beginning';
            } else if (firstNum > 1 && questions[firstNum - 2]) {
              insertPositionId = questions[firstNum - 2].id;
            }
          }
        }

        // Fallback: search for existing question IDs by text overlap
        detected.forEach(sq => {
          const cleanSqText = sq.originalText.replace(/^\d+[\.\-\s]*/, '').trim().toLowerCase();
          const found = questions.find(q => {
            const cleanQText = q.text.replace(/^\d+[\.\-\s]*/, '').trim().toLowerCase();
            return cleanQText.includes(cleanSqText) || cleanSqText.includes(cleanQText);
          });
          if (found && !removeIds.includes(found.id)) {
            removeIds.push(found.id);
          }
        });

        // Set insertion position based on first removed question index if still null
        if (!insertPositionId && removeIds.length > 0) {
          const firstRemovedIdx = questions.findIndex(q => q.id === removeIds[0]);
          if (firstRemovedIdx === 0) {
            insertPositionId = 'beginning';
          } else if (firstRemovedIdx > 0 && questions[firstRemovedIdx - 1]) {
            insertPositionId = questions[firstRemovedIdx - 1].id;
          }
        }

        // Step 2: Structure-aware chunking
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

        // Step 3: Question Manifest tracking
        const totalQuestions = detected.length;
        const processedQuestions: { [id: string]: any } = {};
        const failedQuestions: { [id: string]: { rawText: string; error: string } } = {};
        let processedCount = 0;

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const chunk = chunks[chunkIdx];
          const expectedIds = chunk.questions.map(q => q.id);

          setProgressText(`Đang xử lý Đợt ${chunkIdx + 1}/${chunks.length} (câu hỏi ${processedCount + 1} - ${Math.min(totalQuestions, processedCount + chunk.questions.length)} / ${totalQuestions})...`);

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
  "id": "[Khớp chính xác ID, ví dụ: ${expectedIds[0]}]",
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
          let retries = 2;

          while (retries >= 0 && !success) {
            try {
              const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [
                    { role: 'system', content: 'Bạn là Trợ lý AI thiết kế khảo sát. Hãy trả về JSON chứa mảng questions_list.' },
                    { role: 'user', content: chunkPrompt }
                  ],
                  currentQuestions: questions,
                  activeQuestionId: null
                })
              });

              if (res.ok) {
                const data = await res.json();
                if (data.tool_calls && data.tool_calls.length > 0) {
                  const tc = data.tool_calls[0];
                  const args = JSON.parse(tc.function.arguments || '{}');
                  if (Array.isArray(args.questions_list)) {
                    chunkQuestions = args.questions_list;
                    success = true;
                  }
                }
              }
            } catch (err) {
              console.warn(`Error processing chunk ${chunk.id}:`, err);
            }

            if (!success) {
              retries--;
              if (retries >= 0) {
                setProgressText(`Đợt ${chunkIdx + 1} gặp lỗi. Đang thử lại sau 1.5 giây (Lần thử lại ${2 - retries}/2)...`);
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
            }
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

          // Save successful extractions
          expectedIds.forEach(id => {
            if (returnedMap[id]) {
              processedQuestions[id] = returnedMap[id];
            }
          });

          // Recovery Queue: Reprocess missing questions individually
          if (missingIds.length > 0) {
            for (const missingId of missingIds) {
              setProgressText(`Khôi phục câu hỏi bị thiếu: ${missingId} / ${totalQuestions}...`);
              const originalQ = chunk.questions.find(q => q.id === missingId)!;
              let recoveredQ = null;
              let recSuccess = false;
              let recRetries = 2;

              const singlePrompt = `Nhiệm vụ: Trích xuất thông tin câu hỏi khảo sát dưới đây thành cấu trúc JSON.

CÂU HỎI (ID: ${missingId}):
${originalQ.originalText}

Trả về JSON hành động "add_questions" chứa mảng "questions_list" gồm duy nhất câu hỏi có ID là "${missingId}".`;

              while (recRetries >= 0 && !recSuccess) {
                try {
                  const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      messages: [
                        { role: 'system', content: 'Bạn là Trợ lý AI thiết kế khảo sát. Hãy trả về JSON chứa mảng questions_list.' },
                        { role: 'user', content: singlePrompt }
                      ],
                      currentQuestions: questions,
                      activeQuestionId: null
                    })
                  });

                  if (res.ok) {
                    const data = await res.json();
                    if (data.tool_calls && data.tool_calls.length > 0) {
                      const tc = data.tool_calls[0];
                      const args = JSON.parse(tc.function.arguments || '{}');
                      if (Array.isArray(args.questions_list) && args.questions_list.length > 0) {
                        recoveredQ = args.questions_list[0];
                        recSuccess = true;
                      }
                    }
                  }
                } catch (err) {
                  console.warn(`Recovery failed for question ${missingId}:`, err);
                }

                if (!recSuccess) {
                  recRetries--;
                  if (recRetries >= 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }

              if (recSuccess && recoveredQ) {
                processedQuestions[missingId] = recoveredQ;
              } else {
                failedQuestions[missingId] = {
                  rawText: originalQ.originalText,
                  error: 'Không thể khôi phục tự động.'
                };
              }
            }
          }

          processedCount += chunk.questions.length;
          if (chunkIdx < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Final Merge & Validation Check
        const allNewQuestions: any[] = [];
        detected.forEach(q => {
          if (processedQuestions[q.id]) {
            const extracted = processedQuestions[q.id];
            let options = extracted.options || [];
            const localOptions = parseOptionsLocally(q.originalText);
            if ((!options || options.length === 0) && localOptions.length > 0) {
              options = localOptions;
            }
            
            allNewQuestions.push({
              text: extracted.text || q.originalText.replace(/^\s*[\-\*\+•]?\s*(?:(?:Câu\s*hỏi|Câu|Question|Q|QT|TH|DS|TK|CT|P|INT|C)\s*\d+|[\d]+)\s*[:\.\-\)\s]/i, '').trim(),
              type: extracted.type || (options.length > 0 ? 'radio' : 'voice'),
              options: options,
              is_branching_question: extracted.is_branching_question !== undefined ? extracted.is_branching_question : true,
              condition_question_id: extracted.condition_question_id || 'q1',
              condition_value: extracted.condition_value || q.group || null
            });
          } else {
            const localOptions = parseOptionsLocally(q.originalText);
            allNewQuestions.push({
              text: q.originalText.replace(/^\s*[\-\*\+•]?\s*(?:(?:Câu\s*hỏi|Câu|Question|Q|QT|TH|DS|TK|CT|P|INT|C)\s*\d+|[\d]+)\s*[:\.\-\)\s]/i, '').trim() + " [CẦN KIỂM TRA LẠI THỦ CÔNG]",
              type: localOptions.length > 0 ? 'radio' : 'voice',
              options: localOptions,
              is_branching_question: true,
              condition_question_id: 'q1',
              condition_value: q.group || null,
              needsManualReview: true
            });
          }
        });

        // Verify and construct final action
        const actionStatusId = `tc-replace-${Date.now()}`;
        const hasReplacements = removeIds.length > 0;
        
        const actionParams = hasReplacements ? {
          remove_ids: removeIds,
          questions_list: allNewQuestions,
          position_after_question_id: insertPositionId
        } : {
          questions_list: allNewQuestions,
          position_after_question_id: insertPositionId
        };

        const finalToolCall = {
          id: actionStatusId,
          type: 'function',
          function: {
            name: hasReplacements ? 'replace_questions' : 'add_questions',
            arguments: JSON.stringify(actionParams)
          }
        };

        const summaryReply = hasReplacements 
          ? `Tôi đã nhận diện được ${detected.length} câu hỏi và phân tích phân nhánh tự động. Phát hiện ${removeIds.length} câu hỏi cũ có trên canvas phù hợp để thay thế. 
Tôi đã thiết lập đề xuất xóa các câu cũ và chèn lại toàn bộ ${allNewQuestions.length} câu hỏi mới phân nhánh đầy đủ. Vui lòng phê duyệt bên dưới.`
          : `Tôi đã phân tích danh sách gồm ${allNewQuestions.length} câu hỏi mới và phân tích phân nhánh điều kiện theo các nhóm đối tượng tương ứng. Vui lòng chấp nhận đề xuất bên dưới để thêm vào form.`;

        const replyMsg: Message = {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: summaryReply,
          tool_calls: [finalToolCall],
          actionStatus: { [actionStatusId]: 'pending' }
        };

        saveMessages([...updatedMessages, replyMsg]);
      } else {
        // Standard Direct Chat Flow (1 call)
        setProgressText('Đang xử lý câu trả lời...');
        const apiHistory = updatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiHistory,
            currentQuestions: questions,
            activeQuestionId: isGlobalMode ? null : selectedQuestionId
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gặp lỗi khi giao tiếp với AI.');
        }

        const initialActionStatus: { [key: string]: 'pending' | 'accepted' | 'rejected' } = {};
        if (data.tool_calls && data.tool_calls.length > 0) {
          data.tool_calls.forEach((tc: any) => {
            initialActionStatus[tc.id] = 'pending';
          });
        }

        const replyMsg: Message = {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: data.content || '',
          tool_calls: data.tool_calls || undefined,
          actionStatus: data.tool_calls && data.tool_calls.length > 0 ? initialActionStatus : undefined
        };

        saveMessages([...updatedMessages, replyMsg]);
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi gửi tin nhắn.', 'error');
    } finally {
      setIsSending(false);
      setProgressText('');
    }
  };

  // Helper to map dynamic AI question refs (UUID, q1, 1, etc.) to database UUIDs
  const findQuestionIdByAiRef = (aiRef: any): string | null => {
    if (!aiRef) return null;
    const str = String(aiRef).trim().toLowerCase();
    
    // Direct UUID match
    const directMatch = questions.find(q => q.id === aiRef);
    if (directMatch) return directMatch.id;
    
    // Numeric extraction for index-based refs (e.g. "q1", "1", "câu 1")
    const match = str.match(/\d+/);
    if (match) {
      const idx = parseInt(match[0], 10) - 1; // 1-indexed to 0-indexed
      if (idx >= 0 && idx < questions.length) {
        return questions[idx].id;
      }
    }
    
    return null;
  };

  const getQuestionNumberForDisplay = (position_after_question_id: any, remove_ids: any, itemIdx: number) => {
    let insertIndex = questions.length;
    if (position_after_question_id) {
      const posStr = String(position_after_question_id).trim().toLowerCase();
      if (posStr === 'beginning' || posStr === 'start' || posStr === 'đầu' || posStr === 'q0' || posStr === 'câu 0') {
        insertIndex = 0;
      } else {
        const resolvedAfterId = findQuestionIdByAiRef(position_after_question_id);
        if (resolvedAfterId) {
          const matchedIdx = questions.findIndex(k => k.id === resolvedAfterId);
          if (matchedIdx !== -1) {
            insertIndex = matchedIdx + 1;
          }
        }
      }
    } else if (Array.isArray(remove_ids) && remove_ids.length > 0) {
      const firstRemovedId = findQuestionIdByAiRef(remove_ids[0]);
      if (firstRemovedId) {
        const matchedIdx = questions.findIndex(k => k.id === firstRemovedId);
        if (matchedIdx !== -1) {
          insertIndex = matchedIdx;
        }
      }
    }
    return insertIndex + itemIdx + 1;
  };

  // Human-in-the-loop: Confirm Tool Action
  const handleConfirmAction = (messageId: string, toolCallId: string, actionName: string, params: any) => {
    let updatedQuestions = [...questions];

    try {
      if (actionName === 'add_question' || actionName === 'add_questions') {
        const { text, type, position_after_question_id, options, questions_list } = params;
        
        let listToInsert: any[] = [];
        if (actionName === 'add_questions' && Array.isArray(questions_list)) {
          listToInsert = questions_list;
        } else {
          listToInsert = [{ text, type, options }];
        }

        // First pass: map all new questions with temporary IDs and store local ref key
        const newQs: Question[] = listToInsert.map((item, qIdx) => {
          const tempId = `ai-add-${Date.now()}-${qIdx}`;
          return {
            id: tempId,
            type: item.type || 'text',
            text: item.text || 'Câu hỏi mới tạo bởi AI',
            options: item.options || (['radio', 'checkbox', 'dropdown'].includes(item.type) ? ['Lựa chọn 1', 'Lựa chọn 2'] : []),
            is_required: false,
            is_branching_question: item.is_branching_question || false,
            visibility_type: item.condition_question_id ? 'conditional' : 'always',
            condition_question_id: item.condition_question_id || null, // Will resolve in next step
            condition_value: item.condition_value || null,
            _tempLocalRef: item.id || `q${qIdx + 1}` // Store temp ref key (e.g. q1, q2)
          } as any;
        });

        // Combined helper to resolve references across both existing and new questions
        const allTempQs = [...updatedQuestions, ...newQs];
        const resolveRefId = (ref: any) => {
          if (!ref) return null;
          const str = String(ref).trim().toLowerCase();
          
          // Match existing database questions
          const resolvedId = findQuestionIdByAiRef(ref);
          if (resolvedId) return resolvedId;
          
          // Match new questions being added in this batch
          const matchNew = newQs.find(n => (n as any)._tempLocalRef?.toLowerCase() === str);
          if (matchNew) return matchNew.id;
          
          // Extract digit fallback
          const matchDigit = str.match(/\d+/);
          if (matchDigit) {
            const idx = parseInt(matchDigit[0], 10) - 1;
            if (idx >= 0 && idx < allTempQs.length) {
              return allTempQs[idx].id;
            }
          }
          return null;
        };

        // Second pass: resolve condition_question_id to UUIDs or temporary IDs
        newQs.forEach(nq => {
          if (nq.condition_question_id) {
            const resolved = resolveRefId(nq.condition_question_id);
            if (resolved) {
              nq.condition_question_id = resolved;
              nq.visibility_type = 'conditional';
            } else {
              nq.condition_question_id = null;
              nq.visibility_type = 'always';
            }
          }
          delete (nq as any)._tempLocalRef; // clean up temp key
        });

        // Determine where to insert using findQuestionIdByAiRef
        let insertIndex = updatedQuestions.length;
        if (position_after_question_id) {
          const posStr = String(position_after_question_id).trim().toLowerCase();
          if (posStr === 'beginning' || posStr === 'start' || posStr === 'đầu' || posStr === 'q0' || posStr === 'câu 0') {
            insertIndex = 0;
          } else {
            const resolvedAfterId = findQuestionIdByAiRef(position_after_question_id);
            if (resolvedAfterId) {
              const matchedIdx = updatedQuestions.findIndex(k => k.id === resolvedAfterId);
              if (matchedIdx !== -1) {
                insertIndex = matchedIdx + 1;
              }
            }
          }
        }

        updatedQuestions.splice(insertIndex, 0, ...newQs);
        onQuestionsChange(updatedQuestions);
        if (newQs.length > 0) {
          onSelectQuestion(newQs[0].id);
        }
        toast(`Đã thêm thành công ${newQs.length} câu hỏi và thiết lập phân nhánh!`, 'success');

      } else if (actionName === 'remove_question') {
        const { question_id } = params;
        const resolvedId = findQuestionIdByAiRef(question_id);
        if (resolvedId) {
          updatedQuestions = updatedQuestions.filter(k => k.id !== resolvedId);
          onQuestionsChange(updatedQuestions);
          if (selectedQuestionId === resolvedId) {
            onSelectQuestion(updatedQuestions[0]?.id || null);
          }
          toast('Đã xóa câu hỏi khỏi khảo sát!', 'success');
        } else {
          toast('Không tìm thấy câu hỏi để xóa.', 'error');
        }

      } else if (actionName === 'suggest_question_type') {
        const { question_id, suggested_type } = params;
        const resolvedId = findQuestionIdByAiRef(question_id);
        if (resolvedId) {
          updatedQuestions = updatedQuestions.map(k => {
            if (k.id === resolvedId) {
              const options = ['radio', 'checkbox', 'dropdown'].includes(suggested_type) && (!k.options || k.options.length === 0)
                ? ['Lựa chọn 1', 'Lựa chọn 2']
                : k.options;
              return { ...k, type: suggested_type, options };
            }
            return k;
          });
          onQuestionsChange(updatedQuestions);
          onSelectQuestion(resolvedId);
          toast(`Đã đổi câu hỏi sang dạng ${suggested_type.toUpperCase()}!`, 'success');
        } else {
          toast('Không tìm thấy câu hỏi để thay đổi dạng.', 'error');
        }
      } else if (actionName === 'update_questions') {
        const { updates } = params;
        if (!updates || !Array.isArray(updates)) {
          toast('Danh sách cập nhật không hợp lệ.', 'error');
          return;
        }

        let modifiedCount = 0;
        updatedQuestions = updatedQuestions.map(q => {
          const updateItem = updates.find(u => findQuestionIdByAiRef(u.question_id) === q.id);
          if (updateItem) {
            modifiedCount++;
            const resolvedCondId = updateItem.condition_question_id 
              ? findQuestionIdByAiRef(updateItem.condition_question_id)
              : (updateItem.condition_question_id === null ? null : q.condition_question_id);

            return {
              ...q,
              text: updateItem.text !== undefined ? updateItem.text : q.text,
              type: updateItem.type !== undefined ? updateItem.type : q.type,
              options: updateItem.options !== undefined ? updateItem.options : q.options,
              correct_answer: updateItem.correct_answer !== undefined ? updateItem.correct_answer : q.correct_answer,
              explanation: updateItem.explanation !== undefined ? updateItem.explanation : (q as any).explanation,
              difficulty: updateItem.difficulty !== undefined ? updateItem.difficulty : (q as any).difficulty,
              topic: updateItem.topic !== undefined ? updateItem.topic : (q as any).topic,
              is_branching_question: updateItem.is_branching_question !== undefined ? updateItem.is_branching_question : q.is_branching_question,
              visibility_type: updateItem.condition_question_id !== undefined 
                ? (updateItem.condition_question_id ? 'conditional' : 'always') 
                : q.visibility_type,
              condition_question_id: resolvedCondId,
              condition_value: updateItem.condition_value !== undefined ? updateItem.condition_value : q.condition_value
            };
          }
          return q;
        });

        onQuestionsChange(updatedQuestions);
        toast(`Đã cập nhật câu hỏi & đáp án thành công cho ${modifiedCount} câu!`, 'success');
      } else if (actionName === 'set_correct_answers') {
        const { answers_list } = params;
        if (!answers_list || !Array.isArray(answers_list)) {
          toast('Danh sách đáp án không hợp lệ.', 'error');
          return;
        }

        let modifiedCount = 0;
        updatedQuestions = updatedQuestions.map(q => {
          const updateItem = answers_list.find(a => findQuestionIdByAiRef(a.question_id || a.id) === q.id);
          if (updateItem) {
            modifiedCount++;
            return {
              ...q,
              correct_answer: updateItem.correct_answer !== undefined ? updateItem.correct_answer : (updateItem.answer !== undefined ? updateItem.answer : q.correct_answer),
              explanation: updateItem.explanation !== undefined ? updateItem.explanation : (q as any).explanation,
              difficulty: updateItem.difficulty !== undefined ? updateItem.difficulty : (q as any).difficulty,
              topic: updateItem.topic !== undefined ? updateItem.topic : (q as any).topic
            };
          }
          return q;
        });

        onQuestionsChange(updatedQuestions);
        toast(`Đã áp dụng đáp án AI chuẩn xác cho ${modifiedCount} câu hỏi!`, 'success');
      } else if (actionName === 'replace_questions') {
        const { remove_ids, questions_list, position_after_question_id } = params;
        if (!Array.isArray(remove_ids) || !Array.isArray(questions_list)) {
          toast('Tham số thay thế không hợp lệ.', 'error');
          return;
        }

        // 1. Remove targeted questions
        const resolvedRemoveIds = remove_ids.map(id => findQuestionIdByAiRef(id)).filter(Boolean);
        updatedQuestions = updatedQuestions.filter(q => !resolvedRemoveIds.includes(q.id));

        // 2. Map new questions with temporary IDs and store local ref key
        const newQs: Question[] = questions_list.map((item, qIdx) => {
          const tempId = `ai-add-${Date.now()}-${qIdx}`;
          return {
            id: tempId,
            type: item.type || 'text',
            text: item.text || 'Câu hỏi mới tạo bởi AI',
            options: item.options || (['radio', 'checkbox', 'dropdown'].includes(item.type) ? ['Lựa chọn 1', 'Lựa chọn 2'] : []),
            is_required: false,
            is_branching_question: item.is_branching_question || false,
            visibility_type: item.condition_question_id ? 'conditional' : 'always',
            condition_question_id: item.condition_question_id || null, // Will resolve in next step
            condition_value: item.condition_value || null,
            _tempLocalRef: item.id || `q${qIdx + 1}` // Store temp ref key (e.g. q1, q2)
          } as any;
        });

        // 3. Combined helper to resolve references across both existing and new questions
        const allTempQs = [...updatedQuestions, ...newQs];
        const resolveRefId = (ref: any) => {
          if (!ref) return null;
          const str = String(ref).trim().toLowerCase();
          
          // Match existing database questions
          const resolvedId = findQuestionIdByAiRef(ref);
          if (resolvedId) return resolvedId;
          
          // Match new questions being added in this batch
          const matchNew = newQs.find(n => (n as any)._tempLocalRef?.toLowerCase() === str);
          if (matchNew) return matchNew.id;
          
          // Extract digit fallback
          const matchDigit = str.match(/\d+/);
          if (matchDigit) {
            const idx = parseInt(matchDigit[0], 10) - 1;
            if (idx >= 0 && idx < allTempQs.length) {
              return allTempQs[idx].id;
            }
          }
          return null;
        };

        // 4. Second pass: resolve condition_question_id to UUIDs or temporary IDs
        newQs.forEach(nq => {
          if (nq.condition_question_id) {
            const resolved = resolveRefId(nq.condition_question_id);
            if (resolved) {
              nq.condition_question_id = resolved;
              nq.visibility_type = 'conditional';
            } else {
              nq.condition_question_id = null;
              nq.visibility_type = 'always';
            }
          }
          delete (nq as any)._tempLocalRef; // clean up temp key
        });

        // 5. Determine where to insert using findQuestionIdByAiRef
        // Determine where to insert using findQuestionIdByAiRef
        let insertIndex = updatedQuestions.length;
        if (position_after_question_id) {
          const posStr = String(position_after_question_id).trim().toLowerCase();
          if (posStr === 'beginning' || posStr === 'start' || posStr === 'đầu' || posStr === 'q0' || posStr === 'câu 0') {
            insertIndex = 0;
          } else {
            const resolvedAfterId = findQuestionIdByAiRef(position_after_question_id);
            if (resolvedAfterId) {
              const matchedIdx = updatedQuestions.findIndex(k => k.id === resolvedAfterId);
              if (matchedIdx !== -1) {
                insertIndex = matchedIdx + 1;
              }
            }
          }
        }

        updatedQuestions.splice(insertIndex, 0, ...newQs);
        onQuestionsChange(updatedQuestions);
        if (newQs.length > 0) {
          onSelectQuestion(newQs[0].id);
        }
        toast(`Đã xóa thành công ${resolvedRemoveIds.length} câu hỏi cũ và chèn ${newQs.length} câu mới phân nhánh!`, 'success');
      }

      // Update message action status in history
      const nextMessages = messages.map(m => {
        if (m.id === messageId && m.actionStatus) {
          return {
            ...m,
            actionStatus: {
              ...m.actionStatus,
              [toolCallId]: 'accepted' as const
            }
          };
        }
        return m;
      });
      saveMessages(nextMessages);

    } catch (e: any) {
      toast(`Không thể thực thi hành động: ${e.message}`, 'error');
    }
  };

  // Human-in-the-loop: Reject/Dismiss Tool Action
  const handleRejectAction = (messageId: string, toolCallId: string) => {
    const nextMessages = messages.map(m => {
      if (m.id === messageId && m.actionStatus) {
        return {
          ...m,
          actionStatus: {
            ...m.actionStatus,
            [toolCallId]: 'rejected' as const
          }
        };
      }
      return m;
    });
    saveMessages(nextMessages);
    toast('Đã từ chối hành động đề xuất.', 'info');
  };

  // Find question index by ID or AI ref representation
  const getQuestionNumberStr = (id: any) => {
    const resolvedId = findQuestionIdByAiRef(id);
    if (!resolvedId) return 'Câu hỏi không xác định';
    const idx = questions.findIndex(q => q.id === resolvedId);
    return idx !== -1 ? `Câu số ${idx + 1}` : 'Câu hỏi không xác định';
  };

  // Clear Chat history
  const handleClearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện với AI?')) {
      const defaultWelcome: Message[] = [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Lịch sử đã được dọn dẹp. Tôi có thể giúp gì thêm cho bạn trong việc xây dựng form khảo sát?'
        }
      ];
      saveMessages(defaultWelcome);
    }
  };

  return (
    <>
      {/* Floating Circular Action Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Suggestion Bubble Notification Popup */}
        {!isOpen && showTooltip && (
          <div className={`text-white rounded-2xl shadow-xl p-3 px-4 text-[11px] font-medium max-w-[240px] relative animate-bounce mr-1 flex items-start gap-2 pr-6 ${
            isQuiz
              ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] border border-orange-300/30 shadow-orange-500/20'
              : 'bg-gradient-to-r from-accentIndigo to-accentViolet border border-indigo-300/20'
          }`}>
            <button 
              onClick={handleDismissTooltip}
              className="absolute top-1.5 right-1.5 text-white/70 hover:text-white transition"
              title="Đóng gợi ý"
            >
              <X size={10} />
            </button>
            <div className="mt-0.5">🤖</div>
            <span className="leading-normal cursor-pointer" onClick={() => setIsOpen(true)}>
              {isQuiz ? 'Muốn thêm câu đố vui hay gợi ý hấp dẫn hơn?' : 'Cần gợi ý hay chỉnh sửa câu hỏi bằng AI?'}
            </span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 ${
            isOpen 
              ? 'bg-slate-600 rotate-90' 
              : isQuiz
                ? 'bg-gradient-to-tr from-[#FF6B4A] to-[#FF5733] shadow-orange-500/20'
                : 'bg-gradient-to-tr from-accentIndigo to-accentViolet'
          }`}
          title="Trợ lý AI thiết kế Form"
        >
          {isOpen ? <X size={20} /> : <Sparkles size={20} className="animate-pulse" />}
        </button>
      </div>

      {/* Slide-out Floating Chat Panel Container */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[550px] max-h-[calc(100vh-140px)] bg-white border border-[#E2E8F0] shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col animate-slide-in">
          {/* Header Panel */}
          <div className={`px-4 py-3 border-b flex items-center justify-between flex-shrink-0 ${
            isQuiz
              ? 'bg-[#FFF0E6] border-[#FFD8C7]'
              : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center ${
                isQuiz ? 'bg-[#FF5733]' : 'bg-accentIndigo'
              }`}>
                <Sparkles size={12} />
              </div>
              <div>
                <h3 className="font-bold text-xs text-textMain uppercase tracking-wide">Trợ lý thiết kế AI</h3>
                <span className={`text-[9px] font-semibold ${isQuiz ? 'text-[#FF5733]' : 'text-accentIndigo'}`}>
                  {isQuiz ? 'Học tập AI Active' : 'LLaMA-3.1 Active'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleClearHistory}
                className="text-[10px] text-textMuted hover:text-red-500 font-semibold transition px-1.5 py-0.5 rounded border border-transparent hover:border-red-100"
                title="Xóa lịch sử chat"
              >
                Xóa lịch sử
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-textMuted hover:text-textMain transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Context Switching Tab Bar */}
          <div className="flex border-b border-[#F1F5F9] text-xs font-semibold bg-slate-50 flex-shrink-0">
            <button
              onClick={() => {
                setIsGlobalMode(true);
                onSelectQuestion(null); // Deselect question context
              }}
              className={`flex-1 text-center py-2 border-b-2 transition ${
                isGlobalMode 
                  ? isQuiz ? 'border-[#FF5733] text-[#FF5733] bg-white font-extrabold' : 'border-accentIndigo text-accentIndigo bg-white'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              Hỏi đáp chung
            </button>
            <button
              onClick={() => {
                if (questions.length === 0) {
                  toast('Chưa có câu hỏi nào để chọn ngữ cảnh.', 'info');
                  return;
                }
                setIsGlobalMode(false);
                if (!selectedQuestionId) {
                  onSelectQuestion(questions[0].id); // Pick first question by default
                }
              }}
              className={`flex-1 text-center py-2 border-b-2 transition ${
                !isGlobalMode 
                  ? isQuiz ? 'border-[#FF5733] text-[#FF5733] bg-white font-extrabold' : 'border-accentIndigo text-accentIndigo bg-white'
                  : 'border-transparent text-textMuted hover:text-textMain'
              }`}
            >
              Căn theo câu hỏi
            </button>
          </div>

          {/* Active Context Banner when in contextual mode */}
          {!isGlobalMode && (
            <div className="bg-purple-50 text-purple-700 text-[10px] font-bold px-4 py-2 border-b border-purple-100 flex items-center justify-between flex-shrink-0 animate-fade-in">
              <span className="flex items-center gap-1">
                <MessageSquare size={10} />
                Đang biên tập: {selectedQuestionId ? getQuestionNumberStr(selectedQuestionId) : '-- Chưa chọn câu hỏi --'}
              </span>
              {selectedQuestionId && (
                <button
                  onClick={() => onSelectQuestion(null)}
                  className="text-[9px] text-purple-500 hover:text-purple-700 underline"
                >
                  Bỏ chọn câu
                </button>
              )}
            </div>
          )}

          {/* Message List Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Avatar / Role */}
                  <span className="text-[9px] font-bold text-textMuted uppercase mb-1 px-1">
                    {isUser ? 'Bạn' : '🤖 Trợ lý AI'}
                  </span>

                  {/* Message bubble */}
                  <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                    isUser 
                      ? isQuiz
                        ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] text-white rounded-tr-none shadow-orange-500/10'
                        : 'bg-accentIndigo text-white rounded-tr-none' 
                      : 'bg-white text-textMain border border-[#E2E8F0] rounded-tl-none'
                  }`}>
                    {/* Render plain text response */}
                    {m.content && <p className="whitespace-pre-line">{m.content}</p>}

                    {/* Render Tool Call Action cards */}
                    {m.tool_calls && m.tool_calls.map((tc) => {
                      const status = m.actionStatus?.[tc.id] || 'pending';
                      const args = JSON.parse(tc.function.arguments || '{}');
                      
                      return (
                        <div key={tc.id} className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-textMain text-left flex flex-col gap-2">
                          {/* Tool Add Question / Add Questions */}
                          {(tc.function.name === 'add_question' || tc.function.name === 'add_questions') && (
                            <>
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-indigo-700">
                                <Plus size={14} className="mt-0.5" />
                                {tc.function.name === 'add_questions' ? 'Đề xuất thêm danh sách câu hỏi mới' : 'Đề xuất thêm câu hỏi mới'}
                              </div>
                              <div className="text-[10px] text-textMuted leading-tight bg-white p-2 rounded border border-slate-100 flex flex-col gap-2 max-h-48 overflow-y-auto">
                                {tc.function.name === 'add_questions' && Array.isArray(args.questions_list) ? (
                                  args.questions_list.map((item: any, itemIdx: number) => (
                                    <div key={itemIdx} className="border-b border-slate-100 pb-1.5 mb-1.5 last:border-b-0 last:pb-0 last:mb-0">
                                      <div><span className="font-bold">Câu {getQuestionNumberForDisplay(args.position_after_question_id, null, itemIdx)}. Nội dung:</span> {item.text}</div>
                                      <div><span className="font-bold">Loại:</span> {item.type?.toUpperCase()}</div>
                                      {item.options && item.options.length > 0 && (
                                        <div><span className="font-bold">Đáp án:</span> {item.options.join(', ')}</div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <>
                                    <div><span className="font-bold">Nội dung:</span> {args.text}</div>
                                    <div><span className="font-bold">Loại:</span> {args.type?.toUpperCase()}</div>
                                    {args.options && args.options.length > 0 && (
                                      <div><span className="font-bold">Đáp án:</span> {args.options.join(', ')}</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          )}

                          {/* Tool Remove Question */}
                          {tc.function.name === 'remove_question' && (
                            <>
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-red-600">
                                <AlertCircle size={14} className="mt-0.5" />
                                Đề xuất XÓA câu hỏi
                              </div>
                              <div className="text-[10px] text-red-700 bg-red-50/50 p-2.5 rounded border border-red-100/60 leading-normal">
                                Cảnh báo: AI đề xuất xóa câu hỏi: <span className="font-bold">{getQuestionNumberStr(args.question_id)}</span>
                              </div>
                            </>
                          )}

                          {/* Tool Suggest Question Type */}
                          {tc.function.name === 'suggest_question_type' && (
                            <>
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-purple-700">
                                <HelpCircle size={14} className="mt-0.5" />
                                Gợi ý đổi dạng câu hỏi
                              </div>
                              <div className="text-[10px] text-textMuted bg-white p-2 rounded border border-slate-100 flex flex-col gap-1.5 leading-relaxed">
                                <div>Gợi ý đổi <span className="font-bold text-textMain">{getQuestionNumberStr(args.question_id)}</span> sang dạng <span className="font-bold text-purple-700 uppercase">{args.suggested_type}</span></div>
                                <div><span className="font-bold text-textMain">Lý do:</span> {args.reason}</div>
                              </div>
                            </>
                          )}

                          {/* Tool Update Questions */}
                          {tc.function.name === 'update_questions' && (
                            <>
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                                <Edit size={14} className="mt-0.5" />
                                Đề xuất cập nhật câu hỏi & đáp án AI
                              </div>
                              <div className="text-[10px] text-textMuted leading-tight bg-white p-2 rounded border border-slate-100 flex flex-col gap-2 max-h-48 overflow-y-auto">
                                {Array.isArray(args.updates) && args.updates.map((item: any, itemIdx: number) => (
                                  <div key={itemIdx} className="border-b border-slate-100 pb-1.5 mb-1.5 last:border-b-0 last:pb-0 last:mb-0">
                                    <div><span className="font-bold">{itemIdx + 1}. Sửa câu:</span> {getQuestionNumberStr(item.question_id)}</div>
                                    {item.text && <div><span className="font-bold">Đổi nội dung:</span> {item.text}</div>}
                                    {item.type && <div><span className="font-bold">Đổi loại:</span> {item.type?.toUpperCase()}</div>}
                                    {item.correct_answer && <div><span className="font-bold text-emerald-700">Đáp án AI chọn:</span> {item.correct_answer}</div>}
                                    {item.explanation && <div><span className="font-bold text-orange-700">Giải thích:</span> {item.explanation}</div>}
                                    {item.condition_question_id && (
                                      <div><span className="font-bold">Nhánh:</span> Chỉ hiện khi {getQuestionNumberStr(item.condition_question_id)} chọn "{item.condition_value}"</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* Tool Replace Questions */}
                          {tc.function.name === 'replace_questions' && (
                            <>
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                                <Edit size={14} className="mt-0.5" />
                                Đề xuất thay thế/phân nhánh câu hỏi mới
                              </div>
                              <div className="text-[10px] text-textMuted bg-amber-50/50 p-2 rounded border border-amber-100 flex flex-col gap-1">
                                <div><span className="font-bold text-amber-900">Xóa các câu cũ:</span> {Array.isArray(args.remove_ids) ? args.remove_ids.map((id: any) => getQuestionNumberStr(id)).join(', ') : 'Không'}</div>
                                <div><span className="font-bold text-amber-900">Chèn thay thế bằng:</span> {Array.isArray(args.questions_list) ? `${args.questions_list.length} câu mới phân nhánh` : 'Không'}</div>
                              </div>
                              <div className="text-[10px] text-textMuted leading-tight bg-white p-2 rounded border border-slate-100 flex flex-col gap-2 max-h-48 overflow-y-auto">
                                {Array.isArray(args.questions_list) && args.questions_list.map((item: any, itemIdx: number) => (
                                  <div key={itemIdx} className="border-b border-slate-100 pb-1.5 mb-1.5 last:border-b-0 last:pb-0 last:mb-0">
                                    <div><span className="font-bold">Câu {getQuestionNumberForDisplay(args.position_after_question_id, args.remove_ids, itemIdx)}. Nội dung:</span> {item.text}</div>
                                    <div><span className="font-bold">Loại:</span> {item.type?.toUpperCase()}</div>
                                    {item.condition_question_id && (
                                      <div><span className="font-bold">Nhánh:</span> Chỉ hiện khi {getQuestionNumberStr(item.condition_question_id)} chọn "{item.condition_value}"</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* Action Buttons based on confirmation state */}
                          <div className="flex items-center gap-2 mt-1">
                            {status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleConfirmAction(m.id, tc.id, tc.function.name, args)}
                                  className={`text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm ${
                                    isQuiz
                                      ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] hover:opacity-95 shadow-orange-500/20'
                                      : 'bg-accentIndigo hover:bg-indigo-700'
                                  }`}
                                >
                                  <Check size={10} />
                                  Chấp nhận & Áp dụng
                                </button>
                                <button
                                  onClick={() => handleRejectAction(m.id, tc.id)}
                                  className="bg-white border border-slate-200 text-textMuted hover:text-textMain text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                                >
                                  Từ chối
                                </button>
                              </>
                            ) : status === 'accepted' ? (
                              <span className={`text-[9px] font-bold px-2.5 py-1 rounded flex items-center gap-1 border ${
                                isQuiz
                                  ? 'text-[#FF5733] bg-orange-50 border-orange-200'
                                  : 'text-green-600 bg-green-50 border-green-200'
                              }`}>
                                ✓ Đã áp dụng đáp án & gợi ý vào form
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-textMuted bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                ✕ Đã từ chối đề xuất
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Thinking / Loading Indicator */}
            {isSending && (
              <div className="flex flex-col items-start animate-pulse">
                <span className="text-[9px] font-bold text-textMuted uppercase mb-1 px-1">🤖 Trợ lý AI</span>
                <div className="bg-white border border-[#E2E8F0] text-textMuted rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2 shadow-sm">
                  <Loader2 size={12} className={`animate-spin ${isQuiz ? 'text-[#FF5733]' : 'text-accentIndigo'}`} />
                  {progressText || 'Đang suy luận đáp án chuẩn và phân tích câu hỏi...'}
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Form input bar */}
          <form 
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[#E2E8F0] bg-white flex items-center gap-2 flex-shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSending}
              className={`flex-1 border rounded-xl p-2 px-3 text-xs outline-none bg-transparent transition-colors ${
                isQuiz ? 'border-[#FFE0D1] focus:border-[#FF5733]' : 'border-[#E2E8F0] focus:border-accentIndigo'
              }`}
              placeholder={
                isGlobalMode 
                  ? (isQuiz ? "Nhập yêu cầu: 'Giải bài tập', 'Chọn đáp án đúng cho các câu 1-15'..." : "Hỏi cách sửa hoặc thêm câu hỏi...") 
                  : "Đổi dạng câu hỏi này? Đổi đáp án đúng?..."
              }
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className={`w-8 h-8 rounded-xl text-white flex items-center justify-center transition disabled:opacity-40 ${
                isQuiz
                  ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] shadow-md shadow-orange-500/20'
                  : 'bg-accentIndigo hover:bg-indigo-700'
              }`}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
