'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Plus, Trash2, Eye, Share2, Save, BarChart3, Settings, MoveUp, MoveDown, 
  HelpCircle, Copy, CheckSquare, ListPlus, ToggleLeft, ArrowLeft, Loader2, AlertTriangle, Monitor, Mail, Sparkles, CheckCircle2, Video, MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';
import AiChatbox from '@/app/components/AiChatbox';

interface Question {
  id: string; // client-side temp id or db uuid
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

export default function BuilderPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const formId = params.formId as string;

  // Layout states
  const [isMobile, setIsMobile] = useState(false);
  const [bypassMobileBlock, setBypassMobileBlock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [showAiDashboard, setShowAiDashboard] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuiz, setIsQuiz] = useState(false);
  const [isAnalyzingQuiz, setIsAnalyzingQuiz] = useState(false);

  // Monitor screen size for device redirection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch form data
  const fetchForm = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/forms?id=${formId}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi tải khảo sát');
      }

      setTitle(data.form.title);
      setDescription(data.form.description || '');
      setIsQuiz(data.form.is_quiz || false);
      
      // Map questions
      if (data.questions) {
        const mappedQuestions = data.questions.map((q: any) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer,
          is_required: q.is_required,
          is_branching_question: q.is_branching_question,
          visibility_type: q.visibility_type,
          condition_question_id: q.condition_question_id,
          condition_value: q.condition_value
        }));
        setQuestions(mappedQuestions);
        if (mappedQuestions.length > 0) {
          setSelectedQuestionId(prev => {
            if (prev && mappedQuestions.some((m: any) => m.id === prev)) return prev;
            return mappedQuestions[0].id;
          });
        }
      }
    } catch (err: any) {
      toast(err.message || 'Không tìm thấy khảo sát.', 'error');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (formId) {
      fetchForm();
    }
  }, [formId]);

  // Handle mobile share / email
  const handleEmailLink = () => {
    const subject = encodeURIComponent("Link chỉnh sửa khảo sát hoiyAi");
    const body = encodeURIComponent(`Xin chào,\n\nĐây là link chỉnh sửa khảo sát của bạn. Hãy mở trên Desktop/Laptop để chỉnh sửa:\n${window.location.href}\n\nTrân trọng!`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  // Add Question
  const addQuestion = (type: string) => {
    const tempId = `temp-${Date.now()}`;
    const newQ: Question = {
      id: tempId,
      type,
      text: type === 'info'
        ? 'Chào mừng bạn đến với bản khảo sát! Hãy đọc thông tin hướng dẫn và nhấn nút Tiếp tục để bắt đầu.'
        : `Câu hỏi mới loại ${type}`,
      options: ['radio', 'checkbox', 'dropdown'].includes(type) ? ['Lựa chọn 1', 'Lựa chọn 2'] : [],
      is_required: false,
      is_branching_question: false,
      visibility_type: 'always',
      condition_question_id: null,
      condition_value: null
    };

    setQuestions(prev => [...prev, newQ]);
    setSelectedQuestionId(tempId);
  };

  // Insert Question at specific index
  const insertQuestionAt = (index: number) => {
    const tempId = `temp-${Date.now()}`;
    const newQ: Question = {
      id: tempId,
      type: 'radio',
      text: 'Câu hỏi mới trắc nghiệm',
      options: ['Lựa chọn 1', 'Lựa chọn 2'],
      is_required: false,
      is_branching_question: false,
      visibility_type: 'always',
      condition_question_id: null,
      condition_value: null
    };

    setQuestions(prev => {
      const copy = [...prev];
      copy.splice(index, 0, newQ);
      return copy;
    });
    setSelectedQuestionId(tempId);
  };

  // Update Question Content
  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  // Delete Question
  const deleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (selectedQuestionId === id) {
      setSelectedQuestionId(questions.find(q => q.id !== id)?.id || null);
    }
  };

  // Reorder Questions
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const list = [...questions];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    
    setQuestions(list);
  };

  // Save changes to DB
  const handleSaveForm = async () => {
    setIsSaving(true);
    
    // Validate correct answers if in quiz mode
    if (isQuiz) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (['radio', 'checkbox', 'dropdown'].includes(q.type)) {
          if (!q.correct_answer || q.correct_answer.trim() === '') {
            toast(`Câu hỏi số ${i + 1} ("${q.text.substring(0, 30)}...") chưa được chọn đáp án đúng. Chế độ học tập bắt buộc mỗi câu hỏi lựa chọn phải có ít nhất 1 đáp án đúng!`, 'error');
            setIsSaving(false);
            return;
          }
        }
      }
    }

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          is_quiz: isQuiz,
          questions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast('Đã lưu thành công khảo sát!', 'success');
      // Re-fetch to load clean database UUIDs instead of temp-ids
      await fetchForm();
    } catch (err: any) {
      toast(`Lỗi lưu khảo sát: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // AI Quiz mode analysis handler
  const handleAiQuizAnalyze = async () => {
    if (questions.length === 0) {
      toast("Không có câu hỏi nào để phân tích.", "error");
      return;
    }

    setIsAnalyzingQuiz(true);
    toast("AI đang phân tích khảo sát để quyết định phân loại và gợi ý đáp án...", "info");
    try {
      const res = await fetch('/api/ai/quiz-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          questions
        })
      });

      const result = await res.json();
      if (!res.ok || !result.data) {
        throw new Error(result.error || 'Lỗi kết nối AI.');
      }

      const { isQuiz: aiIsQuiz, analysis, suggestedAnswers } = result.data;
      
      // Update states
      setIsQuiz(aiIsQuiz);
      
      // Map suggested answers into questions state
      setQuestions(prev => prev.map(q => {
        if (suggestedAnswers && suggestedAnswers[q.id]) {
          return {
            ...q,
            correct_answer: suggestedAnswers[q.id]
          };
        }
        return q;
      }));

      toast(`[AI Nhận Định] ${analysis}`, "success");
    } catch (err: any) {
      console.error(err);
      toast(`Lỗi AI phân tích: ${err.message}`, "error");
    } finally {
      setIsAnalyzingQuiz(false);
    }
  };

  // Share form link
  const handleShareForm = () => {
    const publicUrl = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(publicUrl);
    toast(`Đã copy link gửi cho người khảo sát: ${publicUrl}`, 'success');
  };

  // Preview form simulation
  const handlePreview = () => {
    window.open(`/f/${formId}?preview=true`, '_blank');
  };

  // Selected Question reference for settings rendering
  const activeQuestion = questions.find(q => q.id === selectedQuestionId);

  // 1. Mobile restriction screen
  if (isMobile && !bypassMobileBlock) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-center">
        <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mb-6">
          <Monitor size={32} />
        </div>
        <h1 className="text-xl font-bold text-textMain mb-3">Tính năng chỉnh sửa chỉ hỗ trợ trên máy tính</h1>
        <p className="text-xs text-textMuted max-w-sm leading-relaxed mb-6">
          Trình tạo form khảo sát (kéo thả, thiết lập phân nhánh) cần không gian màn hình lớn và độ chính xác cao. Vui lòng mở lại link trên Laptop hoặc PC.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleEmailLink}
            className="bg-accentIndigo hover:bg-indigo-700 transition text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
          >
            <Mail size={16} />
            Gửi link qua email cho chính mình
          </button>
          
          <button
            onClick={() => setBypassMobileBlock(true)}
            className="text-xs text-textMuted hover:text-textMain transition underline py-2"
          >
            Tôi vẫn muốn tiếp tục (Chế độ xem hạn chế)
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-xs text-textMuted">
          <Loader2 className="animate-spin text-accentIndigo" />
          Đang tải cấu trúc khảo sát...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top Header Panel */}
      <header className="h-[57px] border-b border-[#E2E8F0] bg-white px-6 py-3 flex items-center justify-between z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="p-1.5 hover:bg-slate-50 border border-[#E2E8F0] rounded transition text-textMuted hover:text-textMain"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-bold text-base text-textMain outline-none border-b border-transparent focus:border-[#E2E8F0] bg-transparent"
              placeholder="Khảo sát chưa đặt tên"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 border border-[#E2E8F0] hover:bg-slate-50 text-textMuted hover:text-textMain transition px-3 py-1.5 rounded text-xs font-semibold"
          >
            <Eye size={14} />
            Xem trước
          </button>

          <button
            onClick={handleShareForm}
            className="flex items-center gap-1.5 border border-[#E2E8F0] hover:bg-slate-50 text-textMuted hover:text-textMain transition px-3 py-1.5 rounded text-xs font-semibold"
          >
            <Share2 size={14} />
            Chia sẻ
          </button>

          <button
            onClick={() => router.push(`/analytics/${formId}`)}
            className="flex items-center gap-1.5 border border-[#E2E8F0] hover:bg-slate-50 text-textMuted hover:text-textMain transition px-3 py-1.5 rounded text-xs font-semibold"
          >
            <BarChart3 size={14} />
            Kết quả
          </button>

          <button
            onClick={handleSaveForm}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-accentIndigo text-white hover:opacity-90 transition px-4 py-1.5 rounded text-xs font-bold shadow-sm"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Lưu khảo sát
          </button>
        </div>
      </header>

      {/* Main 2-Column Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Component Panel */}
        <aside className="w-full md:w-64 border-r border-[#E2E8F0] bg-white p-5 overflow-hidden flex-shrink-0">
          <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-4">Các loại câu hỏi</h2>
          <div className="flex flex-col gap-2">
            {[
              { type: 'info', label: 'Giới thiệu / Ghi chú (Info)', icon: HelpCircle },
              { type: 'radio', label: 'Trắc nghiệm 1 đáp án', icon: CheckSquare },
              { type: 'checkbox', label: 'Nhiều đáp án (Checkbox)', icon: CheckSquare },
              { type: 'text', label: 'Trả lời ngắn (Text)', icon: Settings },
              { type: 'voice', label: 'Ghi âm giọng nói (Voice)', icon: Sparkles },
              { type: 'video', label: 'Phỏng vấn Video & Camera', icon: Video },
              { type: 'scale', label: 'Thang đo rating 1-5', icon: Settings },
              { type: 'dropdown', label: 'Dropdown danh sách', icon: ListPlus },
              { type: 'date', label: 'Ngày / Giờ', icon: Settings },
              { type: 'file', label: 'Tải lên tệp đính kèm', icon: Settings }
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => addQuestion(item.type)}
                className="flex items-center gap-3 w-full text-left border border-[#E2E8F0] hover:border-accentIndigo hover:bg-indigo-50/10 transition p-3 rounded-lg text-xs font-medium text-textMain"
              >
                <item.icon size={14} className="text-textMuted" />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Middle Column: Canvas Zone */}
        <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* Quiz Mode Configuration Bar */}
          <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
                isQuiz 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <CheckCircle2 size={16} />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Chế độ hoạt động</span>
                <span className="text-xs font-bold text-textMain">
                  {isQuiz ? 'Chế độ Học tập / Bài tập trắc nghiệm' : 'Khảo sát ý kiến bình thường'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle switch */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isQuiz}
                  onChange={(e) => setIsQuiz(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 relative transition-colors" />
                <span className="text-xs font-semibold text-textMain">Bật Chế độ Học tập</span>
              </label>

              {/* AI auto-setup button */}
              <button
                type="button"
                onClick={handleAiQuizAnalyze}
                disabled={isAnalyzingQuiz || questions.length === 0}
                className="flex items-center gap-1.5 border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-accentIndigo hover:text-indigo-700 disabled:opacity-50 transition px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm"
              >
                {isAnalyzingQuiz ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    AI Đang phân tích...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    AI Cài đặt Đáp án
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Generator Summary Dashboard */}
          {showAiDashboard && description && (
            <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 border border-indigo-100 rounded-2xl p-5 mb-6 relative animate-slide-in shadow-sm">
              <button 
                onClick={() => setShowAiDashboard(false)}
                className="absolute top-4 right-4 text-textMuted hover:text-textMain transition"
                title="Đóng tóm tắt"
              >
                <Plus className="rotate-45" size={16} />
              </button>
              
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-accentIndigo text-white flex items-center justify-center">
                  <Sparkles size={12} />
                </div>
                <h3 className="font-bold text-xs text-textMain uppercase tracking-wider">
                  Bản thiết kế khảo sát của AI
                </h3>
              </div>

              <p className="text-[11px] text-textMuted leading-relaxed mb-4 max-w-3xl bg-white/70 p-3.5 rounded-xl border border-indigo-200/20 max-h-32 overflow-y-auto">
                {description}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-indigo-100/30 p-3 rounded-xl flex flex-col">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Tổng số câu hỏi</span>
                  <span className="text-base font-extrabold text-accentIndigo">{questions.length}</span>
                </div>

                <div className="bg-white border border-indigo-100/30 p-3 rounded-xl flex flex-col">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Mốc phân nhánh</span>
                  <span className="text-base font-extrabold text-amber-600">{questions.filter(q => q.is_branching_question).length}</span>
                </div>

                <div className="bg-white border border-indigo-100/30 p-3 rounded-xl flex flex-col">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Câu hỏi rẽ nhánh</span>
                  <span className="text-base font-extrabold text-purple-600">{questions.filter(q => q.visibility_type === 'conditional').length}</span>
                </div>

                <div className="bg-white border border-indigo-100/30 p-3 rounded-xl flex flex-col">
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Câu hỏi bắt buộc</span>
                  <span className="text-base font-extrabold text-red-500">{questions.filter(q => q.is_required).length}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {questions.length === 0 ? (
              <div className="border border-dashed border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-textMuted bg-white">
                Chưa có câu hỏi nào. Hãy nhấp vào các loại câu hỏi ở cột bên trái để thêm mới.
              </div>
            ) : (
              <>
                {questions.map((q, idx) => (
                  <React.Fragment key={q.id}>
                  {/* Hover insert zone before question */}
                  <div className="relative h-4 group flex items-center justify-center my-[-8px] z-10">
                    {/* Invisible wider hover area, but visible thin line on hover */}
                    <div className="absolute inset-x-0 h-8 cursor-pointer flex items-center justify-center">
                      <div className="w-full h-[1px] bg-slate-100/50 group-hover:bg-indigo-200 transition-colors" />
                    </div>
                    
                    {/* Plus button that appears on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertQuestionAt(idx);
                      }}
                      className="relative z-20 w-6 h-6 rounded-full bg-white border border-slate-200 hover:border-accentIndigo text-textMuted hover:text-accentIndigo shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-200"
                      title="Thêm câu hỏi tại vị trí này"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`bg-white rounded-xl border p-5 transition relative cursor-pointer ${
                      selectedQuestionId === q.id 
                        ? 'border-accentIndigo shadow-sm ring-1 ring-accentIndigo/10' 
                        : 'border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                  {/* Top line question type & order manipulation */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-accentIndigo uppercase tracking-wide">
                      <span>Câu {idx + 1}:</span>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const updates: Partial<Question> = { type: newType };
                          if (['radio', 'checkbox', 'dropdown'].includes(newType) && (!q.options || q.options.length === 0)) {
                            updates.options = ['Lựa chọn 1', 'Lựa chọn 2'];
                          }
                          updateQuestion(q.id, updates);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-accentIndigo bg-indigo-50 hover:bg-indigo-100 transition px-2 py-0.5 rounded cursor-pointer uppercase text-[10px] outline-none border border-transparent hover:border-accentIndigo/30"
                      >
                        <option value="info">Giới thiệu / Ghi chú (Info)</option>
                        <option value="radio">Radio</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="text">Text</option>
                        <option value="voice">Voice</option>
                        <option value="video">Video</option>
                        <option value="scale">Scale</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="date">Date</option>
                        <option value="file">File</option>
                      </select>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQuestionId(q.id);
                        }}
                        className={`p-1.5 rounded transition ${
                          selectedQuestionId === q.id 
                            ? 'text-accentIndigo hover:bg-indigo-100 bg-indigo-50/50' 
                            : 'text-slate-400 hover:text-accentIndigo hover:bg-slate-100'
                        }`}
                        title="Hỏi AI về câu hỏi này"
                      >
                        <MessageSquare size={11} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 'up'); }}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <MoveUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 'down'); }}
                        disabled={idx === questions.length - 1}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <MoveDown size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                        className="p-1 hover:bg-red-50 text-red-500 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Input for question name */}
                  {q.type === 'info' ? (
                    <textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      className="w-full font-medium text-xs text-textMain outline-none border border-slate-200 focus:border-accentIndigo rounded-xl bg-slate-50/30 p-3.5 mb-4 resize-y min-h-[110px] leading-relaxed"
                      placeholder="Nhập nội dung giới thiệu, ghi chú, hướng dẫn hoặc điều khoản đồng thuận khảo sát tại đây..."
                    />
                  ) : (
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      className="w-full font-bold text-xs text-textMain outline-none border-b border-transparent focus:border-[#E2E8F0] bg-transparent pb-1 mb-4"
                      placeholder="Tiêu đề câu hỏi..."
                    />
                  )}

                  {/* Question Options UI */}
                  {['radio', 'checkbox', 'dropdown'].includes(q.type) && (
                    <div className="flex flex-col gap-2 pl-3">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          {isQuiz && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const isCurrentlyCorrect = q.correct_answer === opt;
                                updateQuestion(q.id, { correct_answer: isCurrentlyCorrect ? null : opt });
                              }}
                              className={`p-1 rounded transition-colors ${
                                q.correct_answer === opt 
                                  ? 'text-green-600 bg-green-50 border border-green-200' 
                                  : 'text-slate-300 hover:text-green-600 hover:bg-green-50/30'
                              }`}
                              title={q.correct_answer === opt ? "Đáp án đúng (Bấm để hủy)" : "Đánh dấu là đáp án đúng"}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          )}

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              newOpts[oIdx] = e.target.value;
                              
                              const correctUpdates: Partial<Question> = { options: newOpts };
                              if (q.correct_answer === opt) {
                                correctUpdates.correct_answer = e.target.value;
                              }
                              updateQuestion(q.id, correctUpdates);
                            }}
                            className="text-xs text-textMain outline-none border-b border-transparent focus:border-[#E2E8F0] bg-transparent py-0.5 flex-1"
                          />
                          
                          <button
                            onClick={() => {
                              const newOpts = q.options.filter((_, idx) => idx !== oIdx);
                              const correctUpdates: Partial<Question> = { options: newOpts };
                              if (q.correct_answer === opt) {
                                correctUpdates.correct_answer = null;
                              }
                              updateQuestion(q.id, correctUpdates);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-textMuted hover:text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateQuestion(q.id, { options: [...q.options, `Lựa chọn ${q.options.length + 1}`] })}
                        className="text-[10px] text-accentIndigo hover:underline font-semibold self-start mt-1 flex items-center gap-1"
                      >
                        <Plus size={10} />
                        Thêm lựa chọn
                      </button>
                    </div>
                  )}

                  {['text', 'textarea'].includes(q.type) && (
                    <div className="pl-3 mb-2">
                      <input
                        type="text"
                        disabled
                        placeholder="Ô nhập câu trả lời của người điền (không nhập được ở đây)..."
                        className="w-full max-w-md border border-[#E2E8F0] bg-slate-50/50 text-xs text-textMuted py-2 px-3 rounded-lg outline-none cursor-not-allowed"
                      />
                    </div>
                  )}

                  {q.type === 'info' && (
                    <div className="border border-dashed border-slate-200 bg-slate-50/50 p-3 rounded-lg text-[10px] text-textMuted flex items-start gap-2 mb-2 leading-relaxed">
                      <HelpCircle size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Màn hình thông tin/giới thiệu:</strong>
                        <p className="mt-0.5 text-textMuted">Người tham gia khảo sát sẽ chỉ đọc tiêu đề câu hỏi ở trên và bấm nút <strong>"Tiếp tục"</strong> để đi tiếp mà không cần điền bất kỳ đáp án nào.</p>
                      </div>
                    </div>
                  )}

                  {q.type === 'voice' && (
                    <div className="border border-dashed border-indigo-100 bg-indigo-50/10 p-3 rounded-lg text-[10px] text-indigo-700 flex items-center gap-2">
                      <Sparkles size={14} />
                      Giao diện trả lời sẽ hiển thị nút ghi âm lớn. Người dùng nói tiếng Việt và Web Speech API sẽ tự động chuyển thành văn bản.
                    </div>
                  )}

                  {q.type === 'video' && (
                    <div className="border border-dashed border-purple-100 bg-purple-50/10 p-3 rounded-lg text-[10px] text-purple-700 flex items-center gap-2 mb-2">
                      <Video size={14} />
                      Giao diện trả lời sẽ kích hoạt Camera và Microphone để ghi hình câu trả lời phỏng vấn trực tuyến.
                    </div>
                  )}

                  {q.type === 'scale' && (
                    <div className="flex gap-2 items-center text-xs text-textMuted py-2">
                      <span>1 (Rất kém)</span>
                      {[1, 2, 3, 4, 5].map(val => (
                        <div key={val} className="w-7 h-7 rounded-full border border-[#E2E8F0] flex items-center justify-center font-bold text-xs text-textMuted">
                          {val}
                        </div>
                      ))}
                      <span>5 (Rất tốt)</span>
                    </div>
                  )}

                  {/* Settings Accordion - Display settings locally inside the card when selected */}
                  {selectedQuestionId === q.id && (
                    <div className="border-t border-[#F1F5F9] mt-5 pt-4 flex flex-col gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 animate-slide-in">
                      <div className="font-bold text-textMuted uppercase text-[9px] tracking-wider">
                        Cấu hình Câu hỏi
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
                        {/* Required toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`req-${q.id}`}
                            checked={q.is_required}
                            onChange={(e) => updateQuestion(q.id, { is_required: e.target.checked })}
                            className="w-4 h-4 text-accentIndigo outline-none border-[#E2E8F0] rounded cursor-pointer"
                          />
                          <label htmlFor={`req-${q.id}`} className="font-semibold text-textMain cursor-pointer select-none">
                            Bắt buộc trả lời
                          </label>
                        </div>

                        {/* Branching trigger settings */}
                        {['radio', 'checkbox', 'dropdown', 'scale'].includes(q.type) && (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`branch-${q.id}`}
                              checked={q.is_branching_question}
                              onChange={(e) => updateQuestion(q.id, { is_branching_question: e.target.checked })}
                              className="w-4 h-4 text-accentIndigo outline-none border-[#E2E8F0] rounded cursor-pointer"
                            />
                            <label htmlFor={`branch-${q.id}`} className="font-semibold text-textMain cursor-pointer select-none">
                              Dùng để phân nhánh
                            </label>
                          </div>
                        )}

                        {/* Checkbox Min Choices Configuration */}
                        {q.type === 'checkbox' && (
                          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                            <span className="font-semibold text-textMain">Số đáp án chọn tối thiểu:</span>
                            <select
                              value={q.correct_answer || '1'}
                              onChange={(e) => updateQuestion(q.id, { correct_answer: e.target.value })}
                              className="border border-[#E2E8F0] rounded px-2.5 py-1 text-xs text-textMain outline-none bg-white font-medium cursor-pointer"
                            >
                              {Array.from({ length: Math.max(1, q.options.length) }, (_, i) => i + 1).map((val) => (
                                <option key={val} value={val.toString()}>
                                  {val} đáp án
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Condition Setting logic */}
                      <div className="border-t border-slate-200/60 pt-3">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                          <div className="w-full md:w-auto">
                            <span className="font-semibold text-textMain block mb-1">Điều kiện hiển thị:</span>
                            <select
                              value={q.visibility_type}
                              onChange={(e) => {
                                const val = e.target.value as 'always' | 'conditional';
                                updateQuestion(q.id, { 
                                  visibility_type: val,
                                  condition_question_id: val === 'always' ? null : q.condition_question_id,
                                  condition_value: val === 'always' ? null : q.condition_value
                                });
                              }}
                              className="border border-[#E2E8F0] rounded p-1.5 text-xs text-textMain outline-none bg-white w-full md:w-56"
                            >
                              <option value="always">Luôn hiển thị (Chung)</option>
                              <option value="conditional">Hiển thị có điều kiện (Phân nhánh)</option>
                            </select>
                          </div>

                          {q.visibility_type === 'conditional' && (
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 w-full border-t md:border-t-0 pt-3 md:pt-0 border-slate-200/60">
                              <div className="flex-1 w-full">
                                <label className="text-[10px] font-bold text-textMuted uppercase block mb-0.5">Quyết định bởi câu hỏi:</label>
                                <select
                                  value={q.condition_question_id || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const condQ = questions.find(k => k.id === val);
                                    
                                    let defaultVal = '';
                                    if (condQ) {
                                      if (condQ.type === 'scale') {
                                        defaultVal = '1';
                                      } else if (condQ.options && condQ.options.length > 0) {
                                        defaultVal = condQ.options[0];
                                      }
                                    }

                                    if (val) {
                                      setQuestions(prev => prev.map(k => k.id === val ? { ...k, is_branching_question: true } : k));
                                    }

                                    updateQuestion(q.id, { 
                                      condition_question_id: val || null,
                                      condition_value: defaultVal || null
                                    });
                                  }}
                                  className="w-full border border-[#E2E8F0] rounded p-1.5 text-xs text-textMain bg-white outline-none cursor-pointer"
                                >
                                  <option value="">-- Chọn câu hỏi --</option>
                                  {(() => {
                                    const activeIdx = questions.findIndex(k => k.id === q.id);
                                    const preceding = questions.slice(0, activeIdx);
                                    const eligible = preceding.filter(k => ['radio', 'checkbox', 'dropdown', 'scale'].includes(k.type));
                                    
                                    if (eligible.length === 0) {
                                      return <option disabled>Không có câu hỏi trắc nghiệm đứng trước</option>;
                                    }
                                    
                                    return eligible.map((k) => {
                                      const qIndex = questions.findIndex(orig => orig.id === k.id);
                                      return (
                                        <option key={k.id} value={k.id}>
                                          Câu {qIndex + 1}: {k.text.substring(0, 25)}... ({k.type.toUpperCase()})
                                        </option>
                                      );
                                    });
                                  })()}
                                </select>
                              </div>

                              {q.condition_question_id && (
                                <div className="w-full sm:w-48">
                                  <label className="text-[10px] font-bold text-textMuted uppercase block mb-0.5">Khi đáp án bằng:</label>
                                  <select
                                    value={q.condition_value || ''}
                                    onChange={(e) => updateQuestion(q.id, { condition_value: e.target.value })}
                                    className="w-full border border-[#E2E8F0] rounded p-1.5 text-xs text-textMain bg-white outline-none cursor-pointer"
                                  >
                                    {(() => {
                                      const condQ = questions.find(k => k.id === q.condition_question_id);
                                      if (!condQ) return <option value="">-- Không có tùy chọn --</option>;
                                      
                                      const opts = condQ.type === 'scale' ? ['1', '2', '3', '4', '5'] : condQ.options;
                                      return (opts || []).map((o, oIdx) => (
                                        <option key={oIdx} value={o}>
                                          {o}
                                        </option>
                                      ));
                                    })()}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Branching Logic Tag overlay if active */}
                  {q.visibility_type === 'conditional' && q.condition_question_id && (
                    <div className="absolute bottom-2 right-4 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded shadow-sm">
                      {(() => {
                        const condQIndex = questions.findIndex(k => k.id === q.condition_question_id);
                        if (condQIndex === -1) return "Chờ liên kết câu hỏi điều kiện...";
                        return `Chỉ hiện khi Câu ${condQIndex + 1} = "${q.condition_value}"`;
                      })()}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}
            
            {/* Final Hover insert zone after the last question */}
            <div className="relative h-4 group flex items-center justify-center my-[-8px] z-10">
              <div className="absolute inset-x-0 h-8 cursor-pointer flex items-center justify-center">
                <div className="w-full h-[1px] bg-slate-100/50 group-hover:bg-indigo-200 transition-colors" />
              </div>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insertQuestionAt(questions.length);
                }}
                className="relative z-20 w-6 h-6 rounded-full bg-white border border-slate-200 hover:border-accentIndigo text-textMuted hover:text-accentIndigo shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-200"
                title="Thêm câu hỏi ở cuối"
              >
                <Plus size={12} />
              </button>
            </div>
          </>
        )}
      </div>
        </main>
      </div>

      {/* AI Assistant Chatbox Widget */}
      <AiChatbox
        formId={formId}
        questions={questions}
        selectedQuestionId={selectedQuestionId}
        onQuestionsChange={(updatedQs) => setQuestions(updatedQs)}
        onSelectQuestion={(id) => setSelectedQuestionId(id)}
      />
    </div>
  );
}
export const dynamic = 'force-dynamic';
