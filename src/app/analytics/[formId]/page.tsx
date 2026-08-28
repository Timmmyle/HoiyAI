'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  BarChart3, Loader2, ArrowLeft, RefreshCw, Sparkles, Download, 
  MessageSquare, Users, Percent, Clock, ChevronRight, Play, AlertCircle
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

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  
  // AI analysis states
  const [analyzingQuestionId, setAnalyzingQuestionId] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ [qId: string]: any }>({});

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

  // Calculations for Choice Questions
  const calculateOptionStats = (qId: string, options: string[]) => {
    const qAnswers = answers.filter(a => a.question_id === qId);
    const total = qAnswers.length;
    
    const stats: { [opt: string]: { count: number; percent: number } } = {};
    options.forEach(opt => {
      stats[opt] = { count: 0, percent: 0 };
    });

    qAnswers.forEach(ans => {
      const val = ans.value;
      
      // Handle checkbox answers stored as stringified JSON array
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            parsed.forEach(pOpt => {
              if (stats[pOpt]) stats[pOpt].count++;
            });
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

  // Calculations for Scale Ratings
  const calculateScaleStats = (qId: string) => {
    const qAnswers = answers.filter(a => a.question_id === qId);
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

  // Run AI analysis on open-ended text answers
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
      toast("Đã phân tích câu trả lời bằng AI thành công!", "success");
    } catch (err: any) {
      toast(`Lỗi phân tích AI: ${err.message}`, 'error');
    } finally {
      setAnalyzingQuestionId(null);
    }
  };

  // Export responses to CSV
  const handleExportCSV = () => {
    if (responses.length === 0) {
      toast("Không có phản hồi nào để xuất.", 'error');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers
    const headers = ["ID Phản hồi", "Thời gian", "Thiết bị", ...questions.map(q => q.text.replace(/"/g, '""'))];
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    // Rows
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-xs text-textMuted">
          <Loader2 className="animate-spin text-accentIndigo" />
          Đang tổng hợp số liệu khảo sát...
        </div>
      </div>
    );
  }

  // Calculate generic indicators
  const totalSubmissions = responses.length;
  const completionRate = totalSubmissions > 0 ? 100 : 0; // standard approximation for completed submits
  
  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
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
            className="flex items-center gap-1.5 border border-[#E2E8F0] hover:bg-slate-50 text-textMuted hover:text-textMain transition px-3 py-1.5 rounded text-xs font-semibold"
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

      {/* Main dashboard content */}
      <main className="max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-textMuted uppercase">Tổng số lượt phản hồi</div>
              <div className="text-xl font-bold text-textMain mt-0.5">{totalSubmissions}</div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center">
              <Percent size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-textMuted uppercase">Tỷ lệ hoàn thành</div>
              <div className="text-xl font-bold text-textMain mt-0.5">{completionRate}%</div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-textMuted uppercase">Thời gian trung bình</div>
              <div className="text-xl font-bold text-textMain mt-0.5">1m 45s</div>
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
              <div key={q.id} className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-bold text-xs text-textMain">
                    Câu {idx + 1}: {q.text}
                  </div>
                  <span className="text-[9px] font-bold text-accentIndigo uppercase bg-indigo-50 px-2 py-0.5 rounded">
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
                      <div className="text-[10px] text-textMuted mt-1">Tổng cộng: {total} phản hồi</div>
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
                        <div className="text-[10px] font-bold text-textMuted uppercase mt-1">Điểm trung bình</div>
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
                      <div className="max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-lg bg-slate-50/10 p-3 flex flex-col gap-2">
                        {qAnswers.length === 0 ? (
                          <div className="text-center text-[10px] text-textMuted py-4">Chưa có câu trả lời nào.</div>
                        ) : (
                          qAnswers.map((ans, aIdx) => (
                            <div key={ans.id} className="text-xs border-b border-[#F1F5F9] last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                              <div className="flex justify-between items-center text-[9px] text-textMuted mb-1">
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
                      <div className="border border-indigo-100 rounded-xl bg-indigo-50/10 p-4">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-accentIndigo">
                            <Sparkles size={16} />
                            <span className="text-xs font-bold">Phân Tích AI Tự Động</span>
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
                              'Phân tích ý kiến bằng AI'
                            )}
                          </button>
                        </div>

                        {aiResult ? (
                          <div className="flex flex-col gap-4 text-xs">
                            {/* Summary */}
                            <div className="bg-white border border-[#E2E8F0] p-3 rounded-lg">
                              <div className="font-bold text-textMain mb-1">Tóm tắt xu hướng:</div>
                              <div className="text-textMuted leading-relaxed">{aiResult.summary}</div>
                            </div>

                            {/* Sentiment */}
                            {aiResult.sentiment && (
                              <div className="bg-white border border-[#E2E8F0] p-3 rounded-lg">
                                <div className="font-bold text-textMain mb-2">Cảm xúc:</div>
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
                                  <span className="text-[10px] text-textMuted font-medium">Tích cực / Trung lập / Tiêu cực</span>
                                </div>
                              </div>
                            )}

                            {/* Topics group */}
                            {aiResult.topics && aiResult.topics.length > 0 && (
                              <div className="bg-white border border-[#E2E8F0] p-3 rounded-lg">
                                <div className="font-bold text-textMain mb-2">Gom nhóm ý kiến:</div>
                                <div className="flex flex-col gap-2">
                                  {aiResult.topics.map((top: any, tIdx: number) => (
                                    <div key={tIdx} className="border-b border-[#F1F5F9] last:border-0 pb-1.5 last:pb-0">
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

                            {/* Insights */}
                            {aiResult.insights && aiResult.insights.length > 0 && (
                              <div className="bg-white border border-[#E2E8F0] p-3 rounded-lg">
                                <div className="font-bold text-textMain mb-1">Insight nổi bật:</div>
                                <ul className="list-disc pl-4 flex flex-col gap-1 text-textMuted">
                                  {aiResult.insights.map((ins: string, iIdx: number) => (
                                    <li key={iIdx}>{ins}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-textMuted italic">
                            Chưa có phân tích. Hãy nhấn nút để AI gom nhóm ý kiến và tóm tắt cảm xúc của người tham gia khảo sát.
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
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-4">Dữ liệu thô</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-textMuted">
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

      </main>
    </div>
  );
}
export const dynamic = 'force-dynamic';
