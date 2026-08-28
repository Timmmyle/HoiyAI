'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3, Loader2, ArrowLeft, RefreshCw, Sparkles, Download,
  MessageSquare, Users, Percent, Clock, ChevronRight, Play, Send, Bot, User
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';

interface Question {
  id: string;
  type: string;
  text: string;
  options: string[];
}

interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  value: string;
  audio_url?: string | null;
}

interface Response {
  id: string;
  created_at: string;
  user_agent: string;
  ip_address: string;
}

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const formId = params.formId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  // AI analysis states
  const [analyzingQuestionId, setAnalyzingQuestionId] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ [qId: string]: any }>({});

  // Chatbot states
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const supabase = createClient();

  // Load database content
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load form details
      const formRes = await fetch(`/api/forms?id=${formId}`);
      const formData = await formRes.json();
      if (!formRes.ok) throw new Error(formData.error);

      setFormTitle(formData.form.title);
      setQuestions(formData.questions || []);

      // Load responses
      const resRes = await fetch(`/api/responses?formId=${formId}`);
      const resData = await resRes.json();
      if (!resRes.ok) throw new Error(resData.error);

      setResponses(resData.responses || []);
      setAnswers(resData.answers || []);
    } catch (err: any) {
      toast(`Lỗi tải dữ liệu báo cáo: ${err.message}`, 'error');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (formId) {
      loadData();
    }
  }, [formId]);

  // Generate automated AI summary on load
  useEffect(() => {
    if (questions.length > 0 && answers.length > 0) {
      generateAutoSummary();
    }
  }, [questions, answers]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helpers to compile all statistics for AI summary
  const compileSummaryData = (qs: Question[], ansList: Answer[]) => {
    return qs.map(q => {
      const isChoice = ['radio', 'checkbox', 'dropdown', 'quiz_radio'].includes(q.type);
      const isScale = q.type === 'scale';

      if (isChoice) {
        const { stats } = calculateOptionStatsForCompile(q.id, q.options, ansList);
        return {
          id: q.id,
          text: q.text,
          type: 'choice',
          stats
        };
      } else if (isScale) {
        const { average, distribution } = calculateScaleStatsForCompile(q.id, ansList);
        return {
          id: q.id,
          text: q.text,
          type: 'scale',
          average,
          distribution
        };
      } else {
        const qAnswers = ansList.filter(a => a.question_id === q.id).map(a => a.value);
        return {
          id: q.id,
          text: q.text,
          type: 'text',
          answers: qAnswers
        };
      }
    });
  };

  const calculateOptionStatsForCompile = (qId: string, options: string[], ansList: Answer[]) => {
    const qAnswers = ansList.filter(a => a.question_id === qId);
    const total = qAnswers.length;
    const stats: { [opt: string]: { count: number; percent: number } } = {};
    options.forEach(opt => { stats[opt] = { count: 0, percent: 0 }; });
    qAnswers.forEach(ans => {
      const val = ans.value;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            parsed.forEach(pOpt => { if (stats[pOpt]) stats[pOpt].count++; });
          }
        } catch {
          if (stats[val]) stats[val].count++;
        }
      } else {
        if (stats[val]) stats[val].count++;
      }
    });
    options.forEach(opt => {
      stats[opt].percent = total > 0 ? Math.round((stats[opt].count / total) * 100) : 0;
    });
    return { stats, total };
  };

  const calculateScaleStatsForCompile = (qId: string, ansList: Answer[]) => {
    const qAnswers = ansList.filter(a => a.question_id === qId);
    const total = qAnswers.length;
    let sum = 0;
    const distribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    qAnswers.forEach(ans => {
      const val = ans.value;
      if (distribution[val] !== undefined) {
        distribution[val]++;
        sum += parseInt(val);
      }
    });
    const average = total > 0 ? (sum / total).toFixed(1) : '0.0';
    return { average, total, distribution };
  };

  const generateAutoSummary = async () => {
    setIsGeneratingSummary(true);
    setMessages([
      { role: 'assistant', content: '*⏳ Đang kết nối AI để đọc dữ liệu và chuẩn bị báo cáo phân tích khảo sát tự động...*' }
    ]);
    try {
      const dataForSummary = compileSummaryData(questions, answers);
      const res = await fetch('/api/ai/analyze/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formTitle,
          summaryData: dataForSummary
        })
      });
      const result = await res.json();
      if (res.ok && result.summary) {
        setMessages([
          { role: 'assistant', content: result.summary }
        ]);
      } else {
        setMessages([
          { role: 'assistant', content: '⚠️ *Không thể tạo báo cáo tóm tắt tự động. Dữ liệu chưa đủ hoặc quota AI hết. Vui lòng thử chat để hỏi tôi.*' }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages([
        { role: 'assistant', content: '⚠️ *Gặp lỗi kết nối khi chuẩn bị báo cáo tóm tắt tự động.*' }
      ]);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMessage || isGeneratingSummary) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    setIsSendingMessage(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '*⏳ Đang phân tích số liệu...*' }]);

    try {
      const dataForSummary = compileSummaryData(questions, answers);
      const res = await fetch('/api/ai/analyze/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formTitle,
          summaryData: dataForSummary,
          messages: newMessages
        })
      });

      const result = await res.json();
      if (res.ok && result.content) {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: result.content }
        ]);
      } else {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: '⚠️ *Gặp lỗi kết nối AI khi xử lý câu hỏi.*' }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: '⚠️ *Lỗi đường truyền kết nối AI.*' }
      ]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Calculations for Choice Questions (graphs)
  const calculateOptionStats = (qId: string, options: string[]) => {
    return calculateOptionStatsForCompile(qId, options, answers);
  };

  // Calculations for Scale Ratings
  const calculateScaleStats = (qId: string) => {
    return calculateScaleStatsForCompile(qId, answers);
  };

  // Run AI analysis on single open-ended question
  const runAIAnalysis = async (qId: string, qText: string) => {
    const qAnswers = answers.filter(a => a.question_id === qId).map(a => a.value);

    if (qAnswers.length === 0) {
      toast("Chưa có câu trả lời nào để phân tích.", 'info');
      return;
    }

    setAnalyzingQuestionId(qId);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formTitle,
          questionText: qText,
          answers: qAnswers
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setAiAnalysisResult(prev => ({
        ...prev,
        [qId]: result.data
      }));
      toast("Đã phân tích bằng AI thành công!", "success");
    } catch (err: any) {
      toast(`Lỗi phân tích AI: ${err.message}`, 'error');
    } finally {
      setAnalyzingQuestionId(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (responses.length === 0) {
      toast("Không có phản hồi nào để xuất.", 'error');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["ID Phản hồi", "Thời gian", "Thiết bị", ...questions.map(q => q.text.replace(/"/g, '""'))];
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    responses.forEach(r => {
      const row = [
        r.id,
        new Date(r.created_at).toLocaleString(),
        r.user_agent.substring(0, 30).replace(/"/g, '""'),
        ...questions.map(q => {
          const ans = answers.find(a => a.response_id === r.id && a.question_id === q.id);
          return ans ? ans.value.replace(/"/g, '""') : "";
        })
      ];
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_cao_khao_sat_${formId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      let cleanLine = line;
      let formattedLine: React.ReactNode = cleanLine;

      if (cleanLine.startsWith('*') && cleanLine.endsWith('*')) {
        cleanLine = cleanLine.slice(1, -1);
        formattedLine = <span className="italic text-slate-500 font-medium">{cleanLine}</span>;
      } else {
        const parts = cleanLine.split('**');
        if (parts.length > 1) {
          formattedLine = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className="text-slate-900 font-bold">{part}</strong>;
            }
            return part;
          });
        }
      }

      return (
        <div key={idx} className="min-h-[1.25rem] leading-relaxed">
          {formattedLine}
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="flex items-center gap-3 text-xs text-textMuted">
          <Loader2 className="animate-spin text-accentIndigo" />
          Đang tổng hợp số liệu khảo sát...
        </div>
      </div>
    );
  }

  const totalSubmissions = responses.length;
  const completionRate = totalSubmissions > 0 ? 100 : 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Navbar Header */}
      <header className="border-b border-[#E2E8F0] bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/builder/${formId}/edit`)}
            className="p-1.5 hover:bg-slate-50 border border-[#E2E8F0] rounded transition text-textMuted hover:text-textMain"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-bold text-textMuted uppercase tracking-wide">Báo Cáo Kết Quả</span>
            <h1 className="font-bold text-sm text-textMain">{formTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 border border-[#E2E8F0] hover:bg-slate-50 text-textMuted hover:text-textMain transition px-3 py-1.5 rounded text-xs font-semibold bg-white"
          >
            <RefreshCw size={14} />
            Làm mới
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-accentIndigo text-white hover:opacity-90 transition px-4 py-1.5 rounded text-xs font-bold shadow-sm"
          >
            <Download size={14} />
            Xuất dữ liệu CSV
          </button>
        </div>
      </header>

      {/* Main Body Split Screen */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT PANEL: Report Dashboard (3/5 Width) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">

          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-accentIndigo flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <div className="text-[9px] font-bold text-textMuted uppercase">Tổng lượt phản hồi</div>
                <div className="text-lg font-bold text-textMain mt-0.5">{totalSubmissions}</div>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-accentIndigo flex items-center justify-center">
                <Percent size={18} />
              </div>
              <div>
                <div className="text-[9px] font-bold text-textMuted uppercase">Tỷ lệ hoàn thành</div>
                <div className="text-lg font-bold text-textMain mt-0.5">{completionRate}%</div>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-accentIndigo flex items-center justify-center">
                <Clock size={18} />
              </div>
              <div>
                <div className="text-[9px] font-bold text-textMuted uppercase">Thời gian trung bình</div>
                <div className="text-lg font-bold text-textMain mt-0.5">1m 45s</div>
              </div>
            </div>
          </div>

          {/* Detailed Question Responses List */}
          <div className="flex flex-col gap-6">
            <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider">Chi tiết câu trả lời</h2>

            {questions.map((q, idx) => {
              const isChoice = ['radio', 'checkbox', 'dropdown', 'quiz_radio'].includes(q.type);
              const isScale = q.type === 'scale';
              const isOpenEnded = ['text', 'textarea', 'voice'].includes(q.type);

              return (
                <div key={q.id} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-bold text-xs text-textMain leading-snug pr-4">
                      Câu {idx + 1}: {q.text}
                    </div>
                    <span className="text-[8px] font-bold text-accentIndigo uppercase bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-full">
                      {q.type}
                    </span>
                  </div>

                  {/* Render Option statistics graph */}
                  {isChoice && (() => {
                    const { stats, total } = calculateOptionStats(q.id, q.options);
                    return (
                      <div className="flex flex-col gap-3">
                        {q.options.map((opt, oIdx) => {
                          const stat = stats[opt] || { count: 0, percent: 0 };
                          return (
                            <div key={oIdx} className="text-xs">
                              <div className="flex justify-between font-semibold mb-1">
                                <span className="text-textMain">{opt}</span>
                                <span className="text-textMuted">{stat.count} lượt ({stat.percent}%)</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accentIndigo rounded-full"
                                  style={{ width: `${stat.percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <div className="text-[9px] text-textMuted mt-1">Tổng cộng: {total} phản hồi</div>
                      </div>
                    );
                  })()}

                  {/* Render Scale Stats */}
                  {isScale && (() => {
                    const { average, total, distribution } = calculateScaleStats(q.id);
                    return (
                      <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="text-center sm:border-r border-[#E2E8F0] pr-6">
                          <div className="text-3xl font-extrabold text-accentIndigo">{average}</div>
                          <div className="text-[9px] font-bold text-textMuted uppercase mt-1">Điểm trung bình</div>
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5 w-full">
                          {['5', '4', '3', '2', '1'].map((val) => {
                            const count = distribution[val] || 0;
                            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={val} className="flex items-center gap-3 text-xs">
                                <span className="w-12 text-textMuted text-right font-semibold">{val} Sao</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="w-16 text-textMuted text-right">{count} lượt</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Render Open Ended Answers List + AI analysis CTA */}
                  {isOpenEnded && (() => {
                    const qAnswers = answers.filter(a => a.question_id === q.id);
                    const aiResult = aiAnalysisResult[q.id];

                    return (
                      <div className="flex flex-col gap-4">
                        {/* Submissions list scroll */}
                        <div className="max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-xl bg-slate-50/30 p-4 flex flex-col gap-2">
                          {qAnswers.length === 0 ? (
                            <div className="text-center text-[10px] text-textMuted py-4">Chưa có câu trả lời nào.</div>
                          ) : (
                            qAnswers.map((ans, aIdx) => (
                              <div key={ans.id} className="text-xs border-b border-slate-100 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                                <div className="flex justify-between items-center text-[9px] text-textMuted mb-1 font-semibold">
                                  <span>Phản hồi #{aIdx + 1}</span>
                                  {ans.audio_url && (
                                    <a
                                      href={ans.audio_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 text-accentIndigo hover:underline"
                                    >
                                      <Play size={10} />
                                      Nghe file ghi âm
                                    </a>
                                  )}
                                </div>
                                <div className="text-textMain italic leading-relaxed">
                                  &quot;{ans.value}&quot;
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* AI Analysis trigger & container */}
                        <div className="border border-indigo-100 rounded-2xl bg-indigo-50/10 p-4">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-accentIndigo">
                              <Sparkles size={16} />
                              <span className="text-xs font-bold">Phân Tích Ý Kiến AI</span>
                            </div>

                            <button
                              onClick={() => runAIAnalysis(q.id, q.text)}
                              disabled={analyzingQuestionId === q.id || qAnswers.length === 0}
                              className="bg-accentIndigo text-white hover:opacity-90 disabled:opacity-50 transition px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              {analyzingQuestionId === q.id ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Đang phân tích...
                                </>
                              ) : (
                                'Phân tích tự động'
                              )}
                            </button>
                          </div>

                          {aiResult ? (
                            <div className="flex flex-col gap-4 text-xs">
                              {/* Summary */}
                              <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-sm">
                                <div className="font-bold text-textMain mb-1.5">Tóm tắt ý kiến:</div>
                                <div className="text-textMuted leading-relaxed">{aiResult.summary}</div>
                              </div>

                              {/* Sentiment */}
                              {aiResult.sentiment && (
                                <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-sm">
                                  <div className="font-bold text-textMain mb-2.5">Sắc thái tình cảm:</div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex h-4 rounded overflow-hidden text-[9px] font-bold text-white text-center">
                                      <div
                                        className="bg-green-500 flex items-center justify-center"
                                        style={{ width: `${aiResult.sentiment.positive}%` }}
                                        title="Tích cực"
                                      >
                                        {aiResult.sentiment.positive > 15 ? `${aiResult.sentiment.positive}%` : ''}
                                      </div>
                                      <div
                                        className="bg-slate-400 flex items-center justify-center"
                                        style={{ width: `${aiResult.sentiment.neutral}%` }}
                                        title="Trung lập"
                                      >
                                        {aiResult.sentiment.neutral > 15 ? `${aiResult.sentiment.neutral}%` : ''}
                                      </div>
                                      <div
                                        className="bg-red-500 flex items-center justify-center"
                                        style={{ width: `${aiResult.sentiment.negative}%` }}
                                        title="Tiêu cực"
                                      >
                                        {aiResult.sentiment.negative > 15 ? `${aiResult.sentiment.negative}%` : ''}
                                      </div>
                                    </div>
                                    <span className="text-[9px] text-textMuted font-semibold">Tích cực / Trung lập / Tiêu cực</span>
                                  </div>
                                </div>
                              )}

                              {/* Topics group */}
                              {aiResult.topics && aiResult.topics.length > 0 && (
                                <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-sm">
                                  <div className="font-bold text-textMain mb-2.5">Gom nhóm chủ đề:</div>
                                  <div className="flex flex-col gap-2">
                                    {aiResult.topics.map((top: any, tIdx: number) => (
                                      <div key={tIdx} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                        <div className="flex justify-between font-bold text-textMain mb-0.5">
                                          <span>{top.name}</span>
                                          <span className="text-accentIndigo">{top.percentage}%</span>
                                        </div>
                                        <div className="text-[10px] text-textMuted leading-tight">{top.description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-textMuted italic">
                              Chưa có phân tích cho câu này. Hãy nhấn nút để AI tự động trích xuất insights và tổng hợp sắc thái ý kiến của người tham gia.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* Responses Raw Data Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
            <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-4">Dữ liệu thô (Raw Data)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-textMuted font-semibold">
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Thiết bị</th>
                    {questions.map((q, idx) => (
                      <th key={q.id} className="py-2.5 px-3 font-bold truncate max-w-[120px]" title={q.text}>
                        Câu {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.length === 0 ? (
                    <tr>
                      <td colSpan={questions.length + 2} className="py-6 text-center text-textMuted italic">
                        Chưa có lượt nộp khảo sát nào.
                      </td>
                    </tr>
                  ) : (
                    responses.map((r) => (
                      <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 whitespace-nowrap text-textMuted">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-textMuted truncate max-w-[100px]" title={r.user_agent}>
                          {r.user_agent}
                        </td>
                        {questions.map((q) => {
                          const ans = answers.find(a => a.response_id === r.id && a.question_id === q.id);
                          return (
                            <td key={q.id} className="py-2.5 px-3 truncate max-w-[120px] text-textMain" title={ans ? ans.value : ''}>
                              {ans ? ans.value : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AI Chatbot (2/5 Width) */}
        <div className="w-full lg:w-[450px] flex flex-col border-t lg:border-t-0 lg:border-l border-[#E2E8F0] bg-white h-full shadow-lg">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accentIndigo to-accentViolet flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xs text-textMain flex items-center gap-1.5">
                  Trợ lý Phân tích HoiyAI
                </h3>
                <p className="text-[9px] text-textMuted mt-0.5">Tự động tóm tắt & Khai phá Insight nổi bật</p>
              </div>
            </div>

            <button
              onClick={generateAutoSummary}
              disabled={isGeneratingSummary}
              className="p-1.5 border border-[#E2E8F0] hover:bg-white rounded transition text-textMuted hover:text-accentIndigo bg-transparent"
              title="Tự động tạo lại báo cáo tóm tắt"
            >
              <RefreshCw size={12} className={isGeneratingSummary ? 'animate-spin text-accentIndigo' : ''} />
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-slate-50/30">
            {messages.map((msg, index) => {
              const isAi = msg.role === 'assistant';
              return (
                <div key={index} className={`flex gap-3 max-w-[90%] ${isAi ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}>
                  {/* Icon */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${isAi
                      ? 'bg-indigo-50 border-indigo-100 text-accentIndigo'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                    {isAi ? <Bot size={14} /> : <User size={14} />}
                  </div>

                  {/* Message body */}
                  <div className={`p-3 rounded-2xl text-xs shadow-sm leading-relaxed border ${isAi
                      ? 'bg-white border-[#E2E8F0] rounded-tl-none text-slate-700'
                      : 'bg-accentIndigo border-indigo-600 text-white rounded-tr-none'
                    }`}>
                    <div className="space-y-1.5">
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-[#E2E8F0] bg-white flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isGeneratingSummary ? "Vui lòng đợi AI tạo báo cáo..." : "Hỏi AI phân tích chi tiết khảo sát..."}
              disabled={isGeneratingSummary || isSendingMessage}
              className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs text-textMain outline-none focus:border-accentIndigo transition"
            />
            <button
              type="submit"
              disabled={isGeneratingSummary || isSendingMessage || !chatInput.trim()}
              className="bg-accentIndigo hover:opacity-90 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition flex items-center justify-center shadow-sm"
            >
              {isSendingMessage ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
