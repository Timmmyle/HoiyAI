'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Plus, Trash2, Eye, Share2, Save, BarChart3, Settings, MoveUp, MoveDown, 
  HelpCircle, Copy, CheckSquare, ListPlus, ToggleLeft, ArrowLeft, Loader2, AlertTriangle, Monitor, Mail, Sparkles, CheckCircle2, Video, MessageSquare, ShieldCheck
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
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string | null;
  topic?: string | null;
}

// Helper to parse checkbox JSON structure safely with multiple correct answers support
const parseCheckboxCorrectAnswer = (val: any) => {
  let min = 1;
  let correct: string[] = [];
  
  if (val) {
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        min = parsed.min || 1;
        
        const c = parsed.correct;
        if (Array.isArray(c)) {
          correct = c;
        } else if (c) {
          correct = [c];
        }
      } catch {}
    } else {
      // Backward compatibility
      if (/^\d+$/.test(val)) {
        min = parseInt(val, 10);
      } else {
        correct = [val];
      }
    }
  }
  return { min, correct };
};

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
  const [learningSettings, setLearningSettings] = useState<any>({
    shuffle_questions: false,
    shuffle_answers: false,
    attempts_limit: 0,
    retake_mode: 'entire',
    learning_mode: 'practice',
    timer_type: 'none',
    timer_value: 0,
    points_per_question: 10,
    streak_bonus: false,
    fast_bonus: false,
    negative_marking: false,
    partial_credit: false
  });
  const [showLearningSettingsModal, setShowLearningSettingsModal] = useState(false);
  const [learningSettingsTab, setLearningSettingsTab] = useState<'general' | 'mode' | 'scoring' | 'ai'>('general');
  const [isAnalyzingQuiz, setIsAnalyzingQuiz] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isFixingWithAi, setIsFixingWithAi] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

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
      if (data.form.learning_settings) {
        setLearningSettings((prev: any) => ({ ...prev, ...data.form.learning_settings }));
      }
      
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
          condition_value: q.condition_value,
          difficulty: q.difficulty || 'medium',
          explanation: q.explanation || null,
          topic: q.topic || null
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
          let hasCorrect = false;
          if (q.type === 'checkbox') {
            const { correct } = parseCheckboxCorrectAnswer(q.correct_answer);
            hasCorrect = correct.length > 0;
          } else {
            hasCorrect = !!(q.correct_answer && q.correct_answer.trim() !== '');
          }

          if (!hasCorrect) {
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
          learning_settings: learningSettings,
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
          if (q.type === 'checkbox') {
            const { min } = parseCheckboxCorrectAnswer(q.correct_answer);
            const rawSuggest = suggestedAnswers[q.id];
            const nextCorrect = Array.isArray(rawSuggest) ? rawSuggest : [rawSuggest];
            return {
              ...q,
              correct_answer: JSON.stringify({ min, correct: nextCorrect })
            };
          }
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

  // AI Pre-Flight Survey Quality Audit
  const handleSurveyAudit = async () => {
    if (questions.length === 0) {
      toast("Chưa có câu hỏi nào để kiểm định.", "error");
      return;
    }

    setIsAuditing(true);
    toast("AI đang kiểm định chất lượng bảng hỏi và tính hợp lý của câu hỏi...", "info");
    try {
      const res = await fetch('/api/ai/survey-audit', {
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
        throw new Error(result.error || 'Lỗi kiểm định.');
      }

      setAuditResult(result.data);
      setShowAuditModal(true);
      toast("Đã hoàn tất kiểm định chất lượng khảo sát!", "success");
    } catch (err: any) {
      toast(`Lỗi kiểm định: ${err.message}`, "error");
    } finally {
      setIsAuditing(false);
    }
  };

  // AI Auto-fix survey questions based on audit findings
  const handleFixWithAi = async () => {
    setIsFixingWithAi(true);
    toast("AI đang tiến hành sửa đổi và tối ưu hóa các câu hỏi...", "info");
    try {
      const res = await fetch('/api/ai/survey-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          questions,
          mode: 'fix',
          auditResult
        })
      });

      const result = await res.json();
      if (!res.ok || !result.data || !Array.isArray(result.data.fixedQuestions)) {
        throw new Error(result.error || 'AI không thể tự động sửa.');
      }

      setQuestions(result.data.fixedQuestions);
      setShowAuditModal(false);
      toast("Đã tự động sửa & tối ưu hóa toàn bộ câu hỏi theo gợi ý của AI!", "success");
    } catch (err: any) {
      toast(`Lỗi sửa theo AI: ${err.message}`, "error");
    } finally {
      setIsFixingWithAi(false);
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
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${
      isQuiz ? 'bg-[#FFF9F2] text-slate-800' : 'bg-[#F8FAFC] text-textMain'
    }`}>
      {/* Top Header Panel */}
      <header className={`h-[60px] border-b transition-colors px-6 py-3 flex items-center justify-between z-50 flex-shrink-0 ${
        isQuiz ? 'border-[#FFE4D6] bg-white/90 backdrop-blur-md' : 'border-[#E2E8F0] bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="p-1.5 hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition text-textMuted hover:text-textMain"
            title="Quay lại trang chủ"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-extrabold text-base text-slate-900 outline-none border-b border-transparent focus:border-slate-300 bg-transparent max-w-[220px] sm:max-w-[320px] truncate"
              placeholder="Khảo sát chưa đặt tên"
            />
          </div>
        </div>

        {/* Center Segmented Toggle Pill (Standardized Across App) */}
        <div className="hidden md:flex justify-center">
          <div className={`p-1 rounded-full border shadow-inner inline-flex items-center gap-1 transition-all ${
            isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setIsQuiz(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                !isQuiz
                  ? 'bg-[#1E293B] text-white shadow-sm'
                  : 'bg-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>📋 Chuyên nghiệp</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQuiz(true)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                isQuiz
                  ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] text-white shadow-md shadow-orange-500/20'
                  : 'bg-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>🎨 Học tập vui</span>
            </button>
          </div>
        </div>

        {/* Clear Hierarchy Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Secondary Equal Action Buttons */}
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 transition px-3 py-1.5 rounded-xl text-xs font-semibold"
          >
            <Eye size={14} />
            <span className="hidden sm:inline">Xem trước</span>
          </button>

          <button
            onClick={handleShareForm}
            className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 transition px-3 py-1.5 rounded-xl text-xs font-semibold"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Chia sẻ</span>
          </button>

          <button
            onClick={() => router.push(`/analytics/${formId}`)}
            className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 transition px-3 py-1.5 rounded-xl text-xs font-semibold"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">Kết quả</span>
          </button>

          {/* AI Special Action */}
          <button
            type="button"
            onClick={handleSurveyAudit}
            disabled={isAuditing || questions.length === 0}
            className={`flex items-center gap-1.5 border transition px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 ${
              isQuiz
                ? 'border-[#FFD8C7] bg-[#FFF0E6] text-[#FF5733] hover:bg-[#FFE4D6]'
                : 'border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700'
            }`}
            title="AI Kiểm định chất lượng bảng hỏi & độ tin cậy"
          >
            {isAuditing ? (
              <Loader2 size={14} className={`animate-spin ${isQuiz ? 'text-[#FF5733]' : 'text-indigo-600'}`} />
            ) : (
              <ShieldCheck size={14} className={isQuiz ? 'text-[#FF5733]' : 'text-indigo-600'} />
            )}
            <span className="hidden md:inline">Kiểm định AI</span>
          </button>

          {/* Primary Action Accent Button */}
          <button
            onClick={handleSaveForm}
            disabled={isSaving}
            className={`flex items-center gap-1.5 text-white transition px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
              isQuiz
                ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] hover:opacity-95 shadow-orange-500/20'
                : 'bg-[#1E293B] hover:bg-[#0F172A]'
            }`}
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
        <aside className={`w-full md:w-64 border-r p-5 overflow-hidden flex-shrink-0 transition-colors ${
          isQuiz ? 'bg-[#FFF9F2]/80 border-[#FFE4D6]' : 'bg-white border-[#E2E8F0]'
        }`}>
          <h2 className={`text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-1.5 ${
            isQuiz ? 'text-[#FF5733]' : 'text-textMuted'
          }`}>
            Các loại câu hỏi
          </h2>
          <div className="flex flex-col gap-2">
            {[
              { type: 'info', label: 'Giới thiệu / Ghi chú', icon: HelpCircle },
              { type: 'radio', label: 'Chọn 1 đáp án', icon: CheckSquare },
              { type: 'checkbox', label: 'Chọn nhiều đáp án', icon: CheckSquare },
              { type: 'text', label: 'Trả lời ngắn', icon: Settings },
              { type: 'voice', label: 'Ghi âm giọng nói', icon: Sparkles },
              { type: 'video', label: 'Phỏng vấn Video', icon: Video },
              { type: 'scale', label: 'Thang điểm (Rating)', icon: Settings },
              // { type: 'dropdown', label: 'Dropdown danh sách', icon: ListPlus },
              { type: 'date', label: 'Ngày / Giờ', icon: Settings },
              { type: 'file', label: 'Tải lên tệp đính kèm', icon: Settings }
            ].filter(item => item.type !== 'dropdown').map((item) => (
              <button
                key={item.type}
                onClick={() => addQuestion(item.type)}
                className={`flex items-center gap-3 w-full text-left border transition-all p-3 rounded-xl text-xs font-bold ${
                  isQuiz
                    ? 'border-[#FFE0D1] bg-white hover:border-[#FF5733] hover:bg-[#FFF0E6] text-slate-800 hover:text-[#FF5733] shadow-sm'
                    : 'border-[#E2E8F0] bg-white hover:border-accentIndigo hover:bg-indigo-50/10 text-slate-800'
                }`}
              >
                <item.icon size={14} className={isQuiz ? 'text-[#FF5733]' : 'text-textMuted'} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Middle Column: Canvas Zone */}
        <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* Mode Info & Actions Bar */}
          <div className={`border p-4 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm transition-colors ${
            isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-white border-[#E2E8F0]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                isQuiz 
                  ? 'bg-orange-50 border-orange-200 text-[#FF5733]' 
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {isQuiz ? <Sparkles size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Chế độ đang bật</span>
                <span className={`text-xs font-extrabold ${isQuiz ? 'text-[#FF5733]' : 'text-slate-900'}`}>
                  {isQuiz ? '🎨 Chế độ Học tập vui (Quiz Mode)' : '📋 Chế độ Khảo sát chuyên nghiệp (Survey Mode)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Learning Settings Modal Trigger */}
              {isQuiz && (
                <button
                  type="button"
                  onClick={() => setShowLearningSettingsModal(true)}
                  className="flex items-center gap-1.5 border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#FF5733] transition px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm"
                >
                  <Settings size={13} />
                  Cài đặt Bài tập
                </button>
              )}

              {/* AI auto-setup button */}
              {isQuiz && (
                <button
                  type="button"
                  onClick={handleAiQuizAnalyze}
                  disabled={isAnalyzingQuiz || questions.length === 0}
                  className="flex items-center gap-1.5 border border-orange-200 bg-orange-50/70 hover:bg-orange-100 text-[#FF5733] disabled:opacity-50 transition px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm"
                >
                  {isAnalyzingQuiz ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-[#FF5733]" />
                      AI Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="text-[#FF5733]" />
                      AI Tự động tìm Đáp án
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* AI Generator Summary Dashboard */}
          {showAiDashboard && description && (
            <div className={`border rounded-2xl p-5 mb-6 relative animate-slide-in shadow-sm transition-colors ${
              isQuiz
                ? 'bg-[#FFF0E6] border-[#FFD8C7] text-slate-800'
                : 'bg-gradient-to-r from-indigo-50/70 to-purple-50/70 border-indigo-100/60 text-textMain'
            }`}>
              <button 
                onClick={() => setShowAiDashboard(false)}
                className={`absolute top-4 right-4 transition ${
                  isQuiz ? 'text-[#FF5733] hover:text-orange-800' : 'text-textMuted hover:text-textMain'
                }`}
                title="Đóng tóm tắt"
              >
                <Plus className="rotate-45" size={16} />
              </button>
              
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center ${
                  isQuiz ? 'bg-[#FF5733]' : 'bg-accentIndigo'
                }`}>
                  <Sparkles size={12} />
                </div>
                <h3 className={`font-extrabold text-xs uppercase tracking-wider ${
                  isQuiz ? 'text-[#FF5733]' : 'text-textMain'
                }`}>
                  {isQuiz ? 'BẢN THIẾT KẾ BÀI TẬP CỦA AI' : 'BẢN THIẾT KẾ KHẢO SÁT CỦA AI'}
                </h3>
              </div>

              <p className={`text-[11px] leading-relaxed mb-4 max-w-3xl p-3.5 rounded-xl border max-h-32 overflow-y-auto ${
                isQuiz
                  ? 'bg-white/80 border-[#FFE0D1] text-slate-800'
                  : 'bg-white/70 border-indigo-200/20 text-textMuted'
              }`}>
                {description}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl flex flex-col border ${
                  isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-white border-indigo-100/30'
                }`}>
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Tổng số câu hỏi</span>
                  <span className={`text-base font-extrabold ${isQuiz ? 'text-[#FF5733]' : 'text-accentIndigo'}`}>{questions.length}</span>
                </div>

                <div className={`p-3 rounded-xl flex flex-col border ${
                  isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-white border-indigo-100/30'
                }`}>
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Mốc phân nhánh</span>
                  <span className="text-base font-extrabold text-amber-600">{questions.filter(q => q.is_branching_question).length}</span>
                </div>

                <div className={`p-3 rounded-xl flex flex-col border ${
                  isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-white border-indigo-100/30'
                }`}>
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-wider mb-0.5">Câu hỏi rẽ nhánh</span>
                  <span className="text-base font-extrabold text-purple-600">{questions.filter(q => q.visibility_type === 'conditional').length}</span>
                </div>

                <div className={`p-3 rounded-xl flex flex-col border ${
                  isQuiz ? 'bg-white border-[#FFE0D1]' : 'bg-white border-indigo-100/30'
                }`}>
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
                        <option value="info">Màn hình thông tin / Ghi chú</option>
                        <option value="radio">Chọn 1 đáp án</option>
                        <option value="checkbox">Chọn nhiều đáp án</option>
                        <option value="text">Trả lời ngắn</option>
                        <option value="voice">Ghi âm giọng nói</option>
                        <option value="video">Phỏng vấn Video</option>
                        <option value="scale">Thang điểm (Rating 1-5)</option>
                        <option value="date">Ngày / Giờ</option>
                        <option value="file">Tải tệp đính kèm</option>
                      </select>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQuestionId(q.id);
                        }}
                        className={`p-1.5 rounded-xl transition ${
                          selectedQuestionId === q.id 
                            ? isQuiz ? 'text-[#FF5733] bg-orange-50' : 'text-accentIndigo bg-indigo-50' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Hỏi AI về câu hỏi này"
                      >
                        <MessageSquare size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition">
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 'up'); }}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                      >
                        <MoveUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); moveQuestion(idx, 'down'); }}
                        disabled={idx === questions.length - 1}
                        className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                      >
                        <MoveDown size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-lg"
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
                      className="w-full font-bold text-xs text-textMain outline-none border-b border-transparent focus:border-slate-300 bg-transparent pb-1 mb-4"
                      placeholder="Tiêu đề câu hỏi..."
                    />
                  )}

                  {/* Question Options UI */}
                  {['radio', 'checkbox', 'dropdown'].includes(q.type) && (
                    <div className="flex flex-col gap-2.5 pl-2">
                      {q.options.map((opt, oIdx) => {
                        let isOptionCorrect = false;
                        if (q.type === 'checkbox') {
                          const { correct } = parseCheckboxCorrectAnswer(q.correct_answer);
                          isOptionCorrect = correct.includes(opt);
                        } else {
                          isOptionCorrect = q.correct_answer === opt;
                        }

                        return (
                          <div key={oIdx} className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                            isQuiz && isOptionCorrect 
                              ? 'bg-emerald-50/80 border-emerald-200 shadow-sm' 
                              : 'bg-white border-transparent hover:border-slate-200'
                          }`}>
                            {isQuiz && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (q.type === 'checkbox') {
                                    const { min, correct } = parseCheckboxCorrectAnswer(q.correct_answer);
                                    const isCurrentlyCorrect = correct.includes(opt);
                                    const nextCorrect = isCurrentlyCorrect
                                      ? correct.filter(c => c !== opt)
                                      : [...correct, opt];
                                    updateQuestion(q.id, { 
                                      correct_answer: JSON.stringify({ min, correct: nextCorrect }) 
                                    });
                                  } else {
                                    const isCurrentlyCorrect = q.correct_answer === opt;
                                    updateQuestion(q.id, { correct_answer: isCurrentlyCorrect ? null : opt });
                                  }
                                }}
                                className="flex items-center gap-1 cursor-pointer select-none group flex-shrink-0"
                                title={isOptionCorrect ? "Đã đánh dấu là đáp án ĐÚNG (Nhấp để hủy)" : "Nhấp để chọn làm đáp án ĐÚNG"}
                              >
                                {isOptionCorrect ? (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-extrabold shadow-sm ring-2 ring-emerald-100 transition-all">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-emerald-500 group-hover:bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold transition-all">
                                    
                                  </span>
                                )}
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
                              className={`text-xs outline-none bg-transparent py-0.5 flex-1 ${
                                isQuiz && isOptionCorrect ? 'font-bold text-emerald-900' : 'text-slate-800'
                              }`}
                            />

                            {isQuiz && isOptionCorrect && (
                              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                ✓ Đáp án đúng
                              </span>
                            )}
                            
                            <button
                              onClick={() => {
                                const newOpts = q.options.filter((_, idx) => idx !== oIdx);
                                const correctUpdates: Partial<Question> = { options: newOpts };
                                if (q.correct_answer === opt) {
                                  correctUpdates.correct_answer = null;
                                }
                                updateQuestion(q.id, correctUpdates);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => updateQuestion(q.id, { options: [...q.options, `Lựa chọn ${q.options.length + 1}`] })}
                        className={`text-[10px] hover:underline font-bold self-start mt-1 flex items-center gap-1 ${
                          isQuiz ? 'text-[#FF5733]' : 'text-accentIndigo'
                        }`}
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

                  {/* Grouped Dedicated Learning-Only Section */}
                  {isQuiz && q.type !== 'info' && (
                    <div className="mt-4 p-4 rounded-2xl bg-[#FFF0E6]/70 border border-[#FFD8C7] space-y-3.5 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-[#FFE0D1] pb-2">
                        <MessageSquare size={13} className="text-[#FF5733]" />
                        <span className="font-extrabold text-xs text-[#FF5733] uppercase tracking-wide">
                          Thiết lập Học tập & Giải thích đáp án
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Độ khó:</span>
                          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                            {(['easy', 'medium', 'hard'] as const).map(diff => (
                              <button
                                key={diff}
                                type="button"
                                onClick={() => updateQuestion(q.id, { difficulty: diff })}
                                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  (q.difficulty || 'medium') === diff
                                    ? diff === 'easy'
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : diff === 'medium'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'bg-rose-500 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {diff === 'easy' ? 'Dễ' : diff === 'medium' ? 'Trung bình' : 'Khó'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Topic Tag */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-700 uppercase">Chủ đề:</span>
                          <input
                            type="text"
                            value={q.topic || ''}
                            onChange={(e) => updateQuestion(q.id, { topic: e.target.value })}
                            placeholder="Ví dụ: Đại số, Từ vựng..."
                            className="text-[11px] border border-slate-200 focus:border-[#FF5733] rounded-lg px-2.5 py-1 outline-none bg-white w-36 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Explanation Input */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          💡 Giải thích đáp án đúng (Practice Mode Explanation):
                        </label>
                        <textarea
                          value={q.explanation || ''}
                          onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                          placeholder="Nhập lý do tại sao đáp án trên lại đúng (người học sẽ thấy ngay khi trả lời ở chế độ Luyện tập)..."
                          className="w-full text-xs text-slate-800 outline-none border border-[#FFE0D1] focus:border-[#FF5733] rounded-xl p-2.5 bg-white resize-y min-h-[50px] leading-relaxed shadow-sm"
                        />
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
                              value={(() => {
                                const val = q.correct_answer;
                                if (val && val.trim().startsWith('{')) {
                                  try {
                                    return JSON.parse(val).min?.toString() || '1';
                                  } catch {}
                                }
                                if (val && /^\d+$/.test(val)) {
                                  return val;
                                }
                                return '1';
                              })()}
                              onChange={(e) => {
                                const nextMin = parseInt(e.target.value, 10);
                                let nextCorrect = null;
                                const val = q.correct_answer;
                                if (val && val.trim().startsWith('{')) {
                                  try {
                                    nextCorrect = JSON.parse(val).correct || null;
                                  } catch {}
                                } else if (val && !/^\d+$/.test(val)) {
                                  nextCorrect = val;
                                }
                                updateQuestion(q.id, { 
                                  correct_answer: JSON.stringify({ min: nextMin, correct: nextCorrect }) 
                                });
                              }}
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

      {/* AI Survey Quality Audit Result Modal */}
      {showAuditModal && auditResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setShowAuditModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition"
            >
              <Plus className="rotate-45" size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-accentIndigo flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-textMain">Kết quả Kiểm định Khảo sát AI</h3>
                <p className="text-[11px] text-textMuted">Đánh giá tính hợp lý, thời gian điền & phát hiện định hướng</p>
              </div>
            </div>

            {/* Score Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/60 p-4 rounded-2xl flex items-center justify-between mb-5">
              <div>
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Điểm Chất lượng</span>
                <span className="text-2xl font-black text-accentIndigo">{auditResult.score}/100</span>
                <span className="ml-2 text-xs font-bold text-indigo-700">({auditResult.grade})</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block">Ước tính thời gian điền</span>
                <span className="text-xs font-extrabold text-textMain">{auditResult.estimatedTime || '3-5 phút'}</span>
              </div>
            </div>

            {/* Strengths */}
            {auditResult.strengths && auditResult.strengths.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Điểm mạnh của Bảng hỏi
                </h4>
                <ul className="flex flex-col gap-1.5 text-xs text-textMain bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/60">
                  {auditResult.strengths.map((str: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {auditResult.issues && auditResult.issues.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Vấn đề phát hiện cần lưu ý
                </h4>
                <div className="flex flex-col gap-2">
                  {auditResult.issues.map((issue: any, idx: number) => (
                    <div key={idx} className="bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl text-xs text-textMain flex items-start gap-2">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <div>
                        {issue.questionId && (
                          <span className="font-bold text-amber-900 block mb-0.5">Vấn đề tại [{issue.questionId}]:</span>
                        )}
                        <span>{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {auditResult.recommendations && auditResult.recommendations.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} /> Khuyên khuyên tối ưu từ AI
                </h4>
                <ul className="flex flex-col gap-1.5 text-xs text-textMain bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60">
                  {auditResult.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-500 font-bold">💡</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleFixWithAi}
                disabled={isFixingWithAi}
                className="flex-1 bg-gradient-to-r from-accentIndigo to-accentViolet hover:opacity-90 transition text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isFixingWithAi ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                Sửa theo AI
              </button>

              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-5 border border-slate-200 hover:bg-slate-50 text-textMuted hover:text-textMain font-semibold py-2.5 rounded-xl text-xs transition"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learning Settings Modal */}
      {showLearningSettingsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col">
            <button
              onClick={() => setShowLearningSettingsModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition"
            >
              <Plus className="rotate-45" size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-textMain">Cài Đặt Bài Tập (Learning Settings)</h3>
                <p className="text-[11px] text-textMuted">Cấu hình gameplay, thứ tự câu hỏi, timer, cách chấm điểm & chế độ học tập</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 mb-5">
              {[
                { id: 'general', label: '1. Thứ tự & Số lượt' },
                { id: 'mode', label: '2. Chế độ Học tập' },
                { id: 'scoring', label: '3. Timer & Chấm điểm' },
                { id: 'ai', label: '4. Ngân hàng & AI' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLearningSettingsTab(tab.id as any)}
                  className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 ${
                    learningSettingsTab === tab.id
                      ? 'border-accentIndigo text-accentIndigo'
                      : 'border-transparent text-textMuted hover:text-textMain'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: General & Order */}
            {learningSettingsTab === 'general' && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-textMain">Xáo trộn thứ tự (Shuffle)</h4>
                  
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <div>
                      <span className="font-semibold text-textMain block">Xáo trộn vị trí các câu hỏi (Shuffle questions)</span>
                      <span className="text-[10px] text-textMuted">Mỗi lần làm bài, các câu hỏi sẽ xuất hiện ở vị trí ngẫu nhiên</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!learningSettings.shuffle_questions}
                      onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, shuffle_questions: e.target.checked }))}
                      className="w-4 h-4 rounded text-accentIndigo focus:ring-accentIndigo"
                    />
                  </label>

                  <div className="border-t border-slate-200/60 pt-3">
                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <div>
                        <span className="font-semibold text-textMain block">Xáo trộn các tùy chọn đáp án (Shuffle answer choices)</span>
                        <span className="text-[10px] text-textMuted">Thứ tự các phương án A, B, C, D sẽ được đổi chỗ ngẫu nhiên</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!learningSettings.shuffle_answers}
                        onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, shuffle_answers: e.target.checked }))}
                        className="w-4 h-4 rounded text-accentIndigo focus:ring-accentIndigo"
                      />
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-textMain">Giới hạn số lần làm bài (Attempts)</h4>
                  <div className="flex items-center gap-4">
                    {[
                      { val: 0, label: 'Không giới hạn' },
                      { val: 1, label: 'Chỉ 1 lần' },
                      { val: 3, label: 'Tối đa 3 lần' }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setLearningSettings((prev: any) => ({ ...prev, attempts_limit: item.val }))}
                        className={`px-3 py-1.5 rounded-xl font-bold border text-xs transition ${
                          learningSettings.attempts_limit === item.val
                            ? 'bg-accentIndigo text-white border-accentIndigo shadow-sm'
                            : 'bg-white border-slate-200 text-textMuted hover:text-textMain'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-textMain">Chế độ làm lại (Retake Mode)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLearningSettings((prev: any) => ({ ...prev, retake_mode: 'entire' }))}
                      className={`p-3 rounded-xl border text-left transition ${
                        learningSettings.retake_mode === 'entire'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-textMuted'
                      }`}
                    >
                      <span className="block text-xs">Làm lại toàn bộ bài</span>
                      <span className="text-[10px] font-normal text-textMuted">Tất cả các câu hỏi sẽ được làm lại từ đầu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLearningSettings((prev: any) => ({ ...prev, retake_mode: 'incorrect_only' }))}
                      className={`p-3 rounded-xl border text-left transition ${
                        learningSettings.retake_mode === 'incorrect_only'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-textMuted'
                      }`}
                    >
                      <span className="block text-xs">Chỉ làm lại câu sai</span>
                      <span className="text-[10px] font-normal text-textMuted">Chỉ giữ lại các câu trả lời sai để ôn luyện</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Learning Modes */}
            {learningSettingsTab === 'mode' && (
              <div className="space-y-3 text-xs">
                {[
                  {
                    id: 'practice',
                    name: 'Chế độ Luyện tập (Practice Mode)',
                    badge: 'Khuyên dùng cho Học tập',
                    desc: 'Hiển thị ngay lập tức đáp án đúng/sai & lời giải thích (Explanation) sau từng câu hỏi. Phù hợp để tự học và ôn tập.',
                    color: 'emerald'
                  },
                  {
                    id: 'test',
                    name: 'Chế độ Kiểm tra (Test Mode)',
                    badge: 'Đánh giá kiến thức',
                    desc: 'Không hiển thị kết quả ngay. Chỉ công bố tổng điểm & đáp án đúng sau khi người nộp hoàn thành toàn bộ bài nộp.',
                    color: 'indigo'
                  },
                  {
                    id: 'exam',
                    name: 'Chế độ Thi đấu / Thi thật (Exam Mode)',
                    badge: 'Giám sát nghiêm ngặt',
                    desc: 'Có đồng hồ đếm ngược. Ẩn hoàn toàn đáp án và không cho phép quay lại câu trước nếu được thiết lập.',
                    color: 'rose'
                  }
                ].map(mode => (
                  <div
                    key={mode.id}
                    onClick={() => setLearningSettings((prev: any) => ({ ...prev, learning_mode: mode.id }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                      learningSettings.learning_mode === mode.id
                        ? 'bg-indigo-50/70 border-accentIndigo shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="learning_mode"
                      checked={learningSettings.learning_mode === mode.id}
                      onChange={() => {}}
                      className="mt-1 text-accentIndigo focus:ring-accentIndigo"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-textMain">{mode.name}</h4>
                        <span className="text-[9px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {mode.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-textMuted mt-1 leading-relaxed">{mode.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: Timer & Scoring */}
            {learningSettingsTab === 'scoring' && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-textMain">Thời gian làm bài (Timer)</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'none', label: 'Không giới hạn' },
                      { id: 'per_question', label: 'Đếm ngược từng câu' },
                      { id: 'total_quiz', label: 'Tổng thời gian bài' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setLearningSettings((prev: any) => ({ ...prev, timer_type: t.id }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                          learningSettings.timer_type === t.id
                            ? 'bg-accentIndigo text-white border-accentIndigo shadow-sm'
                            : 'bg-white border-slate-200 text-textMuted'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {learningSettings.timer_type !== 'none' && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="font-semibold text-textMain">
                        Thời gian {learningSettings.timer_type === 'per_question' ? '(giây / câu)' : '(phút / toàn bài)'}:
                      </span>
                      <input
                        type="number"
                        value={learningSettings.timer_value || 30}
                        onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, timer_value: parseInt(e.target.value, 10) || 0 }))}
                        className="w-24 border border-slate-300 rounded-xl px-3 py-1.5 font-bold outline-none text-center bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-textMain">Điểm số & Thưởng (Points & Bonuses)</h4>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="font-semibold text-textMain">Điểm mỗi câu mặc định:</span>
                    <input
                      type="number"
                      value={learningSettings.points_per_question || 10}
                      onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, points_per_question: parseInt(e.target.value, 10) || 10 }))}
                      className="w-20 border border-slate-300 rounded-xl px-3 py-1 font-bold outline-none text-center bg-white"
                    />
                  </div>

                  <div className="space-y-2 border-t border-slate-200/60 pt-3">
                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <span className="text-textMain">Điểm thưởng trả lời đúng liên tiếp (Streak Bonus)</span>
                      <input
                        type="checkbox"
                        checked={!!learningSettings.streak_bonus}
                        onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, streak_bonus: e.target.checked }))}
                        className="w-4 h-4 rounded text-accentIndigo"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <span className="text-textMain">Điểm phạt khi trả lời sai (Negative Marking)</span>
                      <input
                        type="checkbox"
                        checked={!!learningSettings.negative_marking}
                        onChange={(e) => setLearningSettings((prev: any) => ({ ...prev, negative_marking: e.target.checked }))}
                        className="w-4 h-4 rounded text-accentIndigo"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AI & Bank */}
            {learningSettingsTab === 'ai' && (
              <div className="space-y-4 text-xs">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-5 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white text-accentIndigo flex items-center justify-center mx-auto shadow-sm">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="font-extrabold text-sm text-textMain">Sinh thêm câu hỏi tự động với AI</h4>
                  <p className="text-[11px] text-textMuted max-w-md mx-auto leading-relaxed">
                    AI sẽ dựa trên tài liệu gốc hoặc các câu hỏi hiện tại để sinh thêm các câu hỏi trắc nghiệm mới, tránh trùng lặp và phân loại độ khó tự động.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLearningSettingsModal(false);
                      toast("Tính năng sinh thêm câu hỏi AI nâng cao (Generate More Questions) sẽ có ở khung xem trước!", "info");
                    }}
                    className="bg-accentIndigo hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition"
                  >
                    ✨ Mở Bảng Sinh Câu Hỏi AI
                  </button>
                </div>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">
              <span className="text-[10px] text-textMuted">Tất cả thay đổi sẽ được áp dụng khi nhấn "Lưu khảo sát"</span>
              <button
                type="button"
                onClick={() => {
                  setShowLearningSettingsModal(false);
                  toast("Đã lưu các thiết lập Cài đặt Bài tập!", "success");
                }}
                className="bg-accentIndigo hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                Hoàn tất Cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Chatbox Widget */}
      <AiChatbox
        formId={formId}
        questions={questions}
        selectedQuestionId={selectedQuestionId}
        onQuestionsChange={(updatedQs) => setQuestions(updatedQs)}
        onSelectQuestion={(id) => setSelectedQuestionId(id)}
        isQuiz={isQuiz}
      />
    </div>
  );
}
export const dynamic = 'force-dynamic';
