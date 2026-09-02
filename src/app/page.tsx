'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, FileUp, ArrowRight, LogOut, FileSpreadsheet, Plus,
  Users, CheckCircle2, MessageSquare, Clipboard, Loader2,
  Trash2, Eye, Share2, BarChart3, Edit, Calendar, AlertTriangle, HelpCircle, Info, FileText, Check
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';
import { TEMPLATES_DATA, SurveyTemplate } from '@/lib/templates';

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  // States
  const [session, setSession] = useState<any>(null);
  const [userTier, setUserTier] = useState<'FREE' | 'BASIC' | 'PRO'>('FREE');
  const [userProfileName, setUserProfileName] = useState('');
  const [editName, setEditName] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generateMode, setGenerateMode] = useState<'survey' | 'quiz'>('survey');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<'all' | 'edu' | 'student' | 'event' | 'business'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<SurveyTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Surveys Listing States
  const [mySurveys, setMySurveys] = useState<any[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load user's surveys and profile when authenticated
  useEffect(() => {
    if (session) {
      fetchMySurveys();
      fetchUserProfile();
    } else {
      setMySurveys([]);
      setUserTier('FREE');
      setUserProfileName('');
      setEditName('');
    }
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tier, full_name, tier_expires_at')
        .eq('id', session.user.id)
        .single();
      if (!error && data) {
        // Auto-revert to FREE if subscription expired
        if (data.tier !== 'FREE' && data.tier_expires_at && new Date() > new Date(data.tier_expires_at)) {
          await supabase
            .from('profiles')
            .update({ tier: 'FREE', tier_expires_at: null })
            .eq('id', session.user.id);
          setUserTier('FREE');
          toast("Gói cước trả phí của bạn đã hết hạn. Hệ thống đã chuyển về gói Miễn phí.", "info");
        } else {
          if (data.tier) setUserTier(data.tier);
          if (data.full_name) {
            setUserProfileName(data.full_name);
            setEditName(data.full_name);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (error) {
        toast("Không thể cập nhật thông tin: " + error.message, "error");
      } else {
        setUserProfileName(editName);
        toast("Đã cập nhật thông tin tài khoản thành công.", "success");
        setShowAccountModal(false);
      }
    } catch (err) {
      toast("Lỗi hệ thống.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchMySurveys = async () => {
    setLoadingSurveys(true);
    try {
      const res = await fetch('/api/forms');
      const data = await res.json();
      if (res.ok && data.forms) {
        setMySurveys(data.forms);
      }
    } catch (err) {
      console.error("Error loading surveys:", err);
    } finally {
      setLoadingSurveys(false);
    }
  };

  // Handle Auth redirection
  const handleLogin = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast("Đã đăng xuất thành công.", "success");
  };

  const handleSelectPlan = async (plan: string) => {
    if (!session) {
      toast("Vui lòng đăng nhập trước khi đăng ký gói cước.", "info");
      router.push('/login');
      return;
    }
    if (plan === 'FREE') {
      toast("Tài khoản của bạn đang là gói Miễn phí.", "info");
      return;
    }

    try {
      toast("Đang khởi tạo phiên thanh toán an toàn qua SePay...", "info");
      const res = await fetch('/api/payment/init-sepay-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Dynamically build and submit hidden POST form to SePay Gateway
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.gatewayUrl;
        
        Object.keys(data.fields).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = data.fields[key];
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
      } else {
        toast(data.error || "Gặp lỗi khi kết nối cổng thanh toán.", "error");
      }
    } catch (err) {
      console.error("Payment init error:", err);
      toast("Không thể kết nối cổng thanh toán SePay.", "error");
    }
  };

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // OCR or Document Parsing
  const processFile = async (file: File) => {
    if (userTier === 'FREE') {
      toast("Tính năng tải và phân tích tài liệu chỉ dành cho tài khoản Cơ bản trở lên. Vui lòng nâng cấp gói cước!", "error");
      return;
    }
    const filename = file.name.toLowerCase();

    // Check if it is an image for client-side OCR
    if (filename.match(/\.(jpg|jpeg|png|webp|bmp)$/)) {
      await performOCR(file);
      return;
    }

    // Otherwise, parse .docx, .pdf, or .txt via server API
    setIsParsingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/parse-file', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setPrompt(prev => prev ? `${prev}\n\n[Nội dung tệp đính kèm ${file.name}]:\n${data.text}` : `Tạo khảo sát từ nội dung sau:\n${data.text}`);
        toast(`Đã đính kèm tệp ${file.name} thành công.`, "success");
      } else {
        toast(data.error || 'Lỗi đọc nội dung file.', "error");
      }
    } catch (err: any) {
      console.error(err);
      toast('Không thể kết nối đến máy chủ để giải nén tệp.', "error");
    } finally {
      setIsParsingFile(false);
    }
  };

  // Free client-side OCR using Tesseract.js
  const performOCR = async (file: File) => {
    setOcrProgress('Đang tải OCR engine...');
    try {
      const Tesseract = await import('tesseract.js');

      const result = await Tesseract.recognize(
        file,
        'vie+eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(`Đang nhận diện chữ: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      setPrompt(prev => prev ? `${prev}\n\n[Văn bản OCR từ ảnh ${file.name}]:\n${result.data.text}` : `Tạo khảo sát từ nội dung OCR:\n${result.data.text}`);
      toast(`Đã trích xuất chữ thành công từ ảnh ${file.name}.`, "success");
    } catch (err: any) {
      console.error(err);
      toast('Lỗi nhận diện văn bản OCR từ hình ảnh.', "error");
    } finally {
      setOcrProgress(null);
    }
  };

  // Generate Survey CTA
  const handleGenerateSurvey = async () => {
    if (!session) {
      toast("Vui lòng đăng nhập để lưu trữ và quản lý khảo sát của bạn.", "info");
      handleLogin();
      return;
    }

    if (!prompt.trim()) {
      toast("Vui lòng nhập mô tả hoặc tải tài liệu lên trước khi tạo.", "error");
      return;
    }

    setIsGenerating(true);
    try {
      const isQuizMode = generateMode === 'quiz';
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: prompt,
          is_quiz: isQuizMode 
        })
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Lỗi hệ thống khi sinh khảo sát.');
      }

      // Save form schema to database
      const formSchema = result.data;
      const saveRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formSchema.form_title || (isQuizMode ? 'Bài tập trắc nghiệm tạo bởi AI' : 'Khảo sát tạo bởi AI'),
          description: formSchema.ai_summary || `Tự động khởi tạo bởi AI (${result.usedModel}).`,
          is_quiz: isQuizMode,
          questions: formSchema.questions || []
        })
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveResult.error || 'Lỗi lưu trữ khảo sát vào DB.');
      }

      toast(`Tạo thành công ${isQuizMode ? 'Bài tập trắc nghiệm' : 'Khảo sát'} bằng AI!`, "success");
      router.push(`/builder/${saveResult.formId}/edit`);
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Không thể tạo khảo sát.', "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick templates creation from TEMPLATES_DATA (20 questions + intro)
  const handleCreateFromTemplate = async (templateName: string) => {
    if (!session) {
      toast("Vui lòng đăng nhập để lưu trữ khảo sát.", "info");
      handleLogin();
      return;
    }

    let title = '';
    let description = '';
    let isQuizTemplate = false;
    let learningSettings: any = null;
    let templateQuestions: any[] = [];

    if (templateName === 'Trang trắng') {
      title = generateMode === 'quiz' ? 'Bài tập chưa đặt tên' : 'Khảo sát chưa đặt tên';
      description = 'Biểu mẫu tùy chỉnh được khởi tạo từ trang trắng.';
      isQuizTemplate = generateMode === 'quiz';
      templateQuestions = [
        {
          type: 'radio',
          text: generateMode === 'quiz' ? 'Câu 1: Nhập nội dung câu hỏi trắc nghiệm' : 'Câu 1: Nhập nội dung câu hỏi đầu tiên',
          options: generateMode === 'quiz' ? ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'] : ['Tùy chọn 1', 'Tùy chọn 2'],
          correct_answer: generateMode === 'quiz' ? 'Đáp án A' : undefined,
          is_required: true
        }
      ];
    } else {
      const matchedTmpl = TEMPLATES_DATA.find(t => t.name === templateName);
      title = matchedTmpl ? matchedTmpl.name : (generateMode === 'quiz' ? 'Bài tập chưa đặt tên' : 'Khảo sát chưa đặt tên');
      description = matchedTmpl ? matchedTmpl.fullIntro : 'Mẫu khảo sát khởi tạo nhanh.';
      isQuizTemplate = matchedTmpl ? matchedTmpl.isQuiz : (generateMode === 'quiz');
      learningSettings = matchedTmpl ? matchedTmpl.learningSettings : null;
      templateQuestions = matchedTmpl ? matchedTmpl.questions : [];
    }

    setIsGenerating(true);
    setPreviewTemplate(null);
    try {
      const saveRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          is_quiz: isQuizTemplate,
          learning_settings: learningSettings,
          questions: templateQuestions
        })
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveResult.error);

      toast(`Khởi tạo thành công ${templateName === 'Trang trắng' ? 'trang trắng' : `mẫu ${templateName}`}.`, "success");
      router.push(`/builder/${saveResult.formId}/edit`);
    } catch (err: any) {
      toast(`Lỗi tạo template: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete Survey Handler
  const handleDeleteSurvey = async () => {
    if (!deleteFormId) return;
    try {
      const res = await fetch(`/api/forms/${deleteFormId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setMySurveys(prev => prev.filter(f => f.id !== deleteFormId));
        toast("Đã xóa khảo sát thành công.", "success");
      } else {
        toast(data.error || "Lỗi xóa khảo sát.", "error");
      }
    } catch (err) {
      toast("Không thể xóa khảo sát.", "error");
    } finally {
      setDeleteFormId(null);
    }
  };

  // Share link handler
  const handleShareLink = (formId: string) => {
    const publicUrl = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(publicUrl);
    toast("Đã sao chép đường dẫn khảo sát vào bộ nhớ tạm!", "success");
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${
      generateMode === 'quiz' ? 'bg-[#FFF9F2] text-slate-800' : 'bg-[#F8FAFC] text-textMain'
    }`}>
      {/* 1. Header / Navbar */}
      <header className={`border-b transition-colors px-6 py-4 flex items-center justify-between ${
        generateMode === 'quiz' ? 'border-[#FFE4D6] bg-white/80 backdrop-blur-md' : 'border-[#E2E8F0] bg-white'
      }`}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
          <img src="/logo.jpg" alt="Mustring.com Logo" className="h-11 w-11 object-contain rounded-xl border border-slate-100 shadow-sm" />
          <span className="font-black text-xl tracking-tight text-slate-900">
            Mustring<span className={generateMode === 'quiz' ? 'text-[#FF5733]' : 'text-accentIndigo'}>.com</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-textMuted">
          <a href="#features" className={`transition ${generateMode === 'quiz' ? 'hover:text-[#FF5733]' : 'hover:text-textMain'}`}>Tính năng</a>
          <a href="#aichat" className={`transition ${generateMode === 'quiz' ? 'hover:text-[#FF5733]' : 'hover:text-textMain'}`}>AI Chat</a>
          <a href="#pricing" className={`transition ${generateMode === 'quiz' ? 'hover:text-[#FF5733]' : 'hover:text-textMain'}`}>Bảng giá</a>
        </nav>

        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditName(userProfileName || '');
                  setShowAccountModal(true);
                }}
                className="flex items-center gap-2.5 hover:bg-slate-50 transition px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50"
                title="Cài đặt tài khoản"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${
                  generateMode === 'quiz' ? 'bg-orange-50 border-orange-200 text-[#FF5733]' : 'bg-indigo-50 border-indigo-100 text-accentIndigo'
                }`}>
                  {userProfileName ? userProfileName[0].toUpperCase() : session.user.email[0].toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-[11px] font-bold text-textMain max-w-[120px] truncate leading-tight">
                    {userProfileName || session.user.email.split('@')[0]}
                  </div>
                  <div className="text-[9px] text-textMuted flex items-center gap-1 font-semibold mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${userTier === 'PRO' ? 'bg-indigo-500 animate-pulse' : userTier === 'BASIC' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                    {userTier === 'PRO' ? 'Gói Pro' : userTier === 'BASIC' ? 'Gói Cơ bản' : 'Gói Miễn phí'}
                  </div>
                </div>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 border border-[#E2E8F0] hover:bg-slate-50 transition px-3 py-1.5 rounded text-xs font-semibold"
              >
                <LogOut size={14} />
                Thoát
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className={`transition text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm ${
                generateMode === 'quiz' ? 'bg-[#FF5733] hover:bg-orange-600' : 'bg-textMain hover:bg-slate-800'
              }`}
            >
              Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero & AI Prompt Box Center */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto px-6 py-12">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center bg-slate-200/60 p-1 rounded-2xl mb-6 border border-slate-200 w-fit mx-auto">
            <button
              onClick={() => setGenerateMode('survey')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition ${
                generateMode === 'survey' ? 'bg-white text-accentIndigo shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare size={15} />
              Tạo Khảo Sát Ý Kiến
            </button>

            <button
              onClick={() => setGenerateMode('quiz')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition ${
                generateMode === 'quiz' ? 'bg-[#FF5733] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={15} />
              Tạo Bài Tập Trắc Nghiệm 🎓
            </button>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-3 max-w-2xl mx-auto leading-tight">
            {generateMode === 'quiz' ? (
              <>Tạo <span className="text-[#FF5733]">Bài Tập Trắc Nghiệm</span> Học Tập Trong Vài Giây</>
            ) : (
              <>Tạo Khảo Sát & Thu Nhập Ý Kiến Thông Minh Bằng <span className="text-accentIndigo">Mustring AI</span></>
            )}
          </h1>

          <p className="text-xs sm:text-sm text-textMuted max-w-lg mx-auto leading-relaxed">
            {generateMode === 'quiz'
              ? 'Kể AI nghe bạn muốn dạy gì, hoặc thả file bài giảng vào. AI sẽ tự dựng câu đố, chấm điểm và động viên học sinh liền tay.'
              : 'Tự động thiết kế biểu mẫu khảo sát chuyên nghiệp dành cho giảng viên, sinh viên, sự kiện và nghiên cứu thị trường.'}
          </p>
        </div>

        {/* AI Center Box */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`w-full bg-white rounded-3xl border transition-all p-6 shadow-sm flex flex-col relative overflow-hidden ${
            dragActive
              ? 'border-accentIndigo bg-indigo-50/20'
              : generateMode === 'quiz'
              ? 'border-[#FFE0D1] shadow-xl shadow-orange-500/5'
              : 'border-slate-200/80 shadow-sm'
          }`}
        >
          {generateMode === 'quiz' && (
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-bl from-[#FFE8B6] to-transparent rounded-full blur-2xl pointer-events-none opacity-80" />
          )}

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-pulse">
              <div className="relative mb-4">
                <div className={`w-12 h-12 rounded-full border-2 animate-spin ${
                  generateMode === 'quiz' ? 'border-orange-100 border-t-[#FF5733]' : 'border-indigo-100 border-t-accentIndigo'
                }`} />
                <Sparkles className={`absolute inset-0 m-auto animate-bounce ${
                  generateMode === 'quiz' ? 'text-[#FF5733]' : 'text-accentIndigo'
                }`} size={18} />
              </div>
              <h3 className="font-bold text-xs text-textMain mb-1">
                {generateMode === 'quiz' ? 'AI đang thiết kế bài học vui của bạn...' : 'AI đang tạo khảo sát của bạn...'}
              </h3>
              <p className="text-[10px] text-textMuted max-w-sm leading-relaxed px-4">
                Hệ thống đang chạy qua chuỗi tự động cấu trúc nâng cao. Quá trình này có thể mất vài giây, vui lòng không tắt trình duyệt.
              </p>
            </div>
          ) : (
            <>
              {/* Text Area */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  generateMode === 'quiz'
                    ? 'VD: Bài trắc nghiệm ôn Sử lớp 8, 10 câu, có gợi ý và huy hiệu khi làm đúng hết.'
                    : 'VD: Khảo sát đo lường chất lượng phục vụ quán cà phê, gửi cho khách sau khi thanh toán.'
                }
                rows={4}
                className="w-full text-sm outline-none resize-none border-0 placeholder-slate-400 bg-transparent text-slate-800 mb-4 leading-relaxed relative z-10"
              />

              {/* Progress / Status bars */}
              {(isParsingFile || ocrProgress) && (
                <div className="mb-4 bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-3 text-xs text-textMuted">
                  <Loader2 size={16} className={`animate-spin ${generateMode === 'quiz' ? 'text-[#FF5733]' : 'text-accentIndigo'}`} />
                  <span>
                    {isParsingFile && "Đang giải nén văn bản từ tệp..."}
                    {ocrProgress && ocrProgress}
                  </span>
                </div>
              )}

              {/* Action Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 gap-4 relative z-10">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (userTier === 'FREE') {
                        toast("Tính năng tải và phân tích tài liệu chỉ dành cho tài khoản Cơ bản trở lên. Vui lòng nâng cấp gói cước!", "error");
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    disabled={isParsingFile || !!ocrProgress}
                    className={`flex items-center gap-2 text-xs border border-slate-200/80 transition px-3.5 py-2 rounded-xl font-semibold bg-white ${
                      userTier === 'FREE' ? 'cursor-not-allowed opacity-70 text-slate-400' : 'hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <FileUp size={14} />
                    Đính kèm file (.pdf, .docx, .png) {userTier === 'FREE' && '🔒'}
                  </button>
                </div>

                <button
                  onClick={handleGenerateSurvey}
                  disabled={isParsingFile || !!ocrProgress}
                  className={`text-white transition px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm ${
                    generateMode === 'quiz'
                      ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF5733] hover:opacity-95 shadow-orange-500/20'
                      : 'bg-[#1E293B] hover:bg-[#0F172A]'
                  }`}
                >
                  {generateMode === 'quiz' ? 'Tạo bài học vui →' : 'Tạo Survey bằng AI →'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick Template Strip */}
        <div className="w-full my-10 text-left">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 border-b border-slate-200/80 pb-3 gap-4">
            <div>
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                MẪU TẠO NHANH CHUYÊN BIỆT
              </h2>
              <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                (2 mẫu / chủ đề)
              </span>
            </div>

            {/* Template Category Tabs */}
            <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'edu', label: '🎓 Giảng viên' },
                { id: 'student', label: '📚 Học sinh / Sinh viên' },
                { id: 'event', label: '🎪 Sự kiện' },
                { id: 'business', label: '💼 Doanh nghiệp' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTemplateCategory(cat.id as any)}
                  className={`px-3.5 py-1.5 rounded-full font-bold transition whitespace-nowrap text-[11px] ${
                    templateCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {/* Blank Form Card */}
            <div className="bg-white border border-slate-200/90 hover:border-slate-400 hover:shadow-md transition p-5 rounded-2xl shadow-sm flex flex-col justify-between items-start w-full group relative">
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-slate-100 text-slate-700 border-slate-200 group-hover:scale-105 transition-transform">
                    <Plus size={18} />
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                    Tùy chọn
                  </span>
                </div>

                <h3 className="font-bold text-xs text-textMain mb-1.5 group-hover:text-accentIndigo transition-colors line-clamp-1">
                  Trang trắng (Tùy chỉnh)
                </h3>

                <p className="text-[11px] text-textMuted leading-relaxed line-clamp-2 mb-4">
                  Bắt đầu biểu mẫu khảo sát hoặc bài tập từ con số 0 theo ý bạn
                </p>
              </div>

              <div className="w-full flex items-center justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleCreateFromTemplate('Trang trắng')}
                  disabled={isGenerating}
                  className={`text-white font-bold py-1.5 px-3.5 rounded-xl text-[11px] transition flex items-center gap-1 shadow-xs ${
                    generateMode === 'quiz'
                      ? 'bg-[#FF5733] hover:bg-orange-600 shadow-orange-500/20'
                      : 'bg-accentIndigo hover:bg-indigo-600 shadow-indigo-500/20'
                  }`}
                >
                  Sử dụng <ArrowRight size={11} />
                </button>
              </div>
            </div>

            {TEMPLATES_DATA
              .filter((t) => templateCategory === 'all' || t.category === templateCategory)
              .map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition p-5 rounded-2xl shadow-sm flex flex-col justify-between items-start w-full group relative"
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        tmpl.category === 'edu' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        tmpl.category === 'student' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                        tmpl.category === 'event' ? 'bg-orange-50 text-[#FF5733] border-orange-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        <FileText size={18} />
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        generateMode === 'quiz'
                          ? 'bg-orange-50 text-[#FF5733] border-orange-100'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        20 câu
                      </span>
                    </div>

                    <h3 className="font-bold text-xs text-textMain mb-1.5 group-hover:text-accentIndigo transition-colors line-clamp-1">
                      {tmpl.name}
                    </h3>

                    <p className="text-[11px] text-textMuted leading-relaxed line-clamp-2 mb-4">
                      {tmpl.shortDesc}
                    </p>
                  </div>

                  <div className="w-full flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setPreviewTemplate(tmpl)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 text-[11px] font-semibold"
                      title="Xem chi tiết & giới thiệu mẫu"
                    >
                      <Info size={13} />
                      <span>Chi tiết</span>
                    </button>

                    <button
                      onClick={() => handleCreateFromTemplate(tmpl.name)}
                      disabled={isGenerating}
                      className={`text-white font-bold py-1.5 px-3.5 rounded-xl text-[11px] transition flex items-center gap-1 shadow-xs ${
                        generateMode === 'quiz'
                          ? 'bg-[#FF5733] hover:bg-orange-600 shadow-orange-500/20'
                          : 'bg-accentIndigo hover:bg-indigo-600 shadow-indigo-500/20'
                      }`}
                    >
                      Sử dụng <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Khảo sát của bạn (My Surveys) */}
        {session && (
          <div className="w-full mt-12 text-left">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200/80 pb-2">
              <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider">
                KHẢO SÁT CỦA BẠN ({mySurveys.length})
              </h2>
              <button
                onClick={fetchMySurveys}
                className={`text-[10px] hover:underline font-bold transition-colors ${
                  generateMode === 'quiz' ? 'text-[#FF5733]' : 'text-accentIndigo'
                }`}
              >
                Làm mới danh sách
              </button>
            </div>

            {loadingSurveys ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-textMuted bg-white border border-slate-200 rounded-2xl shadow-sm">
                <Loader2 size={14} className={`animate-spin ${generateMode === 'quiz' ? 'text-[#FF5733]' : 'text-accentIndigo'}`} />
                Đang tải danh sách khảo sát...
              </div>
            ) : mySurveys.length === 0 ? (
              <div className="py-12 text-center text-xs text-textMuted bg-white border border-dashed border-slate-200 rounded-2xl shadow-sm">
                Bạn chưa tạo khảo sát nào. Hãy nhập mô tả ở ô phía trên hoặc chọn một mẫu tạo nhanh để bắt đầu!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {mySurveys.map((form) => (
                  <div
                    key={form.id}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition p-5 rounded-2xl shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                          form.is_quiz 
                            ? 'bg-[#FFF0E6] text-[#FF5733] border-[#FFD8C7]' 
                            : 'bg-indigo-50 text-accentIndigo border-indigo-100'
                        }`}>
                          {form.is_quiz ? 'Bài tập' : 'Form'}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] text-textMuted">
                          <Calendar size={10} />
                          {new Date(form.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <h3 className="font-bold text-xs text-textMain mb-1.5 truncate max-w-[280px]" title={form.title}>
                        {form.title}
                      </h3>
                      <p className="text-[10px] text-textMuted leading-relaxed mb-4 line-clamp-2 min-h-[30px]">
                        {form.description || 'Không có mô tả.'}
                      </p>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/builder/${form.id}/edit`)}
                          className={`flex items-center gap-1 border text-[10px] px-3 py-1.5 rounded-xl transition font-semibold ${
                            generateMode === 'quiz' 
                              ? 'bg-[#FFF9F2] border-[#FFE0D1] text-[#FF5733] hover:bg-[#FFF0E6]' 
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-textMain'
                          }`}
                          title="Chỉnh sửa form"
                        >
                          <Edit size={10} />
                          Sửa
                        </button>

                        <button
                          onClick={() => router.push(`/analytics/${form.id}`)}
                          className={`flex items-center gap-1 border text-[10px] px-3 py-1.5 rounded-xl transition font-semibold ${
                            generateMode === 'quiz' 
                              ? 'bg-[#FFF9F2] border-[#FFE0D1] text-[#FF5733] hover:bg-[#FFF0E6]' 
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-textMain'
                          }`}
                          title="Xem kết quả"
                        >
                          <BarChart3 size={10} />
                          Báo cáo
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleShareLink(form.id)}
                          className="p-1.5 border border-[#E2E8F0] hover:border-accentIndigo hover:text-accentIndigo rounded-lg transition text-textMuted"
                          title="Copy link khảo sát"
                        >
                          <Share2 size={12} />
                        </button>

                        <button
                          onClick={() => setDeleteFormId(form.id)}
                          className="p-1.5 border border-[#E2E8F0] hover:bg-red-50 hover:border-red-200 hover:text-red-500 rounded-lg transition text-textMuted"
                          title="Xóa khảo sát"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Core Features Showcase */}
        <section id="features" className="w-full mt-20 text-left border-t border-[#E2E8F0] pt-12">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-accentIndigo uppercase tracking-wider mb-2">Tính năng ưu việt</h2>
            <h3 className="text-xl font-bold text-textMain">Nền tảng tạo khảo sát mạnh mẽ nhất bằng AI</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
              <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center mb-4">
                <Clipboard size={18} />
              </div>
              <h4 className="font-bold text-sm text-textMain mb-2">Trình Builder chuyên nghiệp</h4>
              <p className="text-xs text-textMuted leading-relaxed">
                Giao diện thiết kế chuyên nghiệp. Bạn có thể kéo thả, sắp xếp, thay đổi thứ tự và đặc biệt là biên tập nội dung **Giới thiệu khảo sát** trực tiếp cho người điền đọc trước khi bắt đầu.
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
              <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center mb-4">
                <Sparkles size={18} />
              </div>
              <h4 className="font-bold text-sm text-textMain mb-2">Nhập tài liệu siêu dài (Chunking)</h4>
              <p className="text-xs text-textMuted leading-relaxed">
                Cấu trúc phân tách tài liệu thông minh (structure-aware chunking). Hỗ trợ nhận diện tự động kể cả câu hỏi không đánh số. Dễ dàng import các tài liệu từ 80 đến 200+ câu hỏi mà không sợ sót câu.
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
              <div className="w-10 h-10 rounded bg-indigo-50 text-accentIndigo flex items-center justify-center mb-4">
                <MessageSquare size={18} />
              </div>
              <h4 className="font-bold text-sm text-textMain mb-2">Lưu trữ siêu tốc an toàn</h4>
              <p className="text-xs text-textMuted leading-relaxed">
                Áp dụng công nghệ pre-assigned UUIDs trên server kết hợp với chèn hàng loạt (atomic batch insert). Thời gian lưu khảo sát 80 câu chỉ dưới 100ms, phòng chống mất mát dữ liệu 100% khi reset server.
              </p>
            </div>
          </div>
        </section>

        {/* 5. AI Chat Showcase */}
        <section id="aichat" className="w-full mt-20 text-left border-t border-[#E2E8F0] pt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-semibold mb-3">
                <Sparkles size={12} />
                AI Chatbot Trợ Lý 2.0
              </div>
              <h3 className="text-xl font-bold text-textMain mb-4">Chỉnh sửa khảo sát bằng giọng nói và hội thoại</h3>
              <p className="text-xs text-textMuted leading-relaxed mb-4">
                Trợ lý AI thiết kế khảo sát hỗ trợ hai chế độ hội thoại thông minh độc quyền giúp tối ưu hóa luồng làm việc của bạn.
              </p>

              <ul className="flex flex-col gap-3 text-xs text-textMuted">
                <li className="flex items-start gap-2">
                  <span className="text-accentIndigo font-bold">✔</span>
                  <div>
                    <strong className="text-textMain">Hỏi đáp chung (Global Mode):</strong> Chat với AI để gợi ý bổ sung, sắp xếp lại hoặc đưa ra định hướng thiết kế cho toàn bộ form khảo sát hiện có.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accentIndigo font-bold">✔</span>
                  <div>
                    <strong className="text-textMain">Căn theo câu hỏi (Contextual Mode):</strong> Chọn một câu hỏi cụ thể để AI chỉ tập trung sửa đổi, thêm lựa chọn hoặc đổi loại (Text, Voice, Radio, Video...) riêng cho câu đó mà không làm ảnh hưởng hay xáo trộn các câu hỏi khác trên Canvas.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accentIndigo font-bold">✔</span>
                  <div>
                    <strong className="text-textMain">Lịch sử và Xác nhận trực quan:</strong> AI trả về các hành động thêm/sửa/xóa dưới dạng thẻ đề xuất (Confirm Action Cards) để bạn duyệt trước khi áp dụng thực tế.
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-[#E2E8F0] p-6 rounded-2xl flex flex-col gap-4 shadow-inner w-full">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-textMuted ml-2 font-mono">Trợ lý AI đang hiển thị...</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-sm max-w-[90%] self-end">
                Chuyển câu số 5 này sang dạng chọn đáp án đi
              </div>
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 text-xs shadow-sm max-w-[95%]">
                <div className="font-bold text-accentIndigo text-[10px] uppercase mb-1">🤖 Trợ lý AI</div>
                Tôi đã tạo đề xuất chuyển đổi duy nhất Câu số 5 từ dạng nhập liệu (Text) sang dạng trắc nghiệm (Radio). Vui lòng xác nhận:
                <div className="mt-2 p-2 bg-white rounded border border-indigo-100 text-[10px] leading-tight">
                  <div className="font-bold text-indigo-700">Gợi ý đổi Câu số 5 sang dạng RADIO</div>
                  <div className="text-textMuted mt-0.5">Lý do: Chuyển đổi định dạng để người dùng dễ chọn lựa.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Pricing Section */}
        <section id="pricing" className="w-full mt-20 text-left border-t border-[#E2E8F0] pt-12 mb-8">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-accentIndigo uppercase tracking-wider mb-2">Bảng giá dịch vụ</h2>
            <h3 className="text-xl font-bold text-textMain">Lựa chọn gói cước phù hợp với nhu cầu của bạn</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-[1000px] mx-auto px-2">
            {/* Gói Miễn Phí */}
            <div className="bg-white text-textMain border border-[#E2E8F0] rounded-2xl p-7 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <h4 className="font-bold text-base text-textMain mb-1">Miễn phí</h4>
                <div className="text-2xl font-extrabold text-textMain mb-4">0đ <span className="text-xs font-normal text-textMuted">/tháng</span></div>
                <p className="text-xs text-textMuted leading-relaxed mb-6">Cho cá nhân thử nghiệm hoặc bài tập nhỏ.</p>
                
                <ul className="flex flex-col gap-3.5 text-xs text-textMain mb-6">
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo khảo sát AI (Tối đa 20 câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo thủ công (Không giới hạn câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="font-bold text-indigo-600">Tối đa 40 kết quả phản hồi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Model gpt-5-nano và gemini-lite</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Trình kéo thả cơ bản</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => {
                  if (userTier === 'FREE') {
                    toast("Bạn đang sử dụng gói cước này.", "info");
                  } else {
                    toast("Bạn đang ở gói cước cao hơn.", "info");
                  }
                }}
                disabled
                className="w-full py-2.5 bg-slate-50 border border-[#E2E8F0] text-textMuted font-bold text-xs rounded-xl cursor-not-allowed opacity-75"
              >
                {userTier === 'FREE' ? 'Gói hiện tại' : 'Gói thấp hơn'}
              </button>
            </div>

            {/* Gói Cơ Bản */}
            <div className="bg-white text-textMain border border-[#E2E8F0] rounded-2xl p-7 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <h4 className="font-bold text-base text-textMain mb-1">Cơ bản</h4>
                <div className="text-2xl font-extrabold text-textMain mb-4">79.000đ <span className="text-xs font-normal text-textMuted">/tháng</span></div>
                <p className="text-xs text-textMuted leading-relaxed mb-6">Cho freelancer và nhóm nhỏ làm khảo sát đều đặn.</p>
                
                <ul className="flex flex-col gap-3.5 text-xs text-textMain mb-6">
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo khảo sát AI (Không giới hạn câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo thủ công (Không giới hạn câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="font-bold text-indigo-600">Tối đa 100 kết quả phản hồi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Nhập file tài liệu vừa</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Xuất kết quả Excel, CSV</span>
                  </li>
                </ul>
              </div>
              {userTier === 'BASIC' ? (
                <button
                  disabled
                  className="w-full py-2.5 bg-blue-50 border border-blue-200 text-blue-600 font-bold text-xs rounded-xl cursor-not-allowed"
                >
                  ✓ Đang sử dụng gói này
                </button>
              ) : userTier === 'PRO' ? (
                <button
                  disabled
                  className="w-full py-2.5 bg-slate-50 border border-[#E2E8F0] text-textMuted font-bold text-xs rounded-xl cursor-not-allowed opacity-75"
                >
                  Gói thấp hơn
                </button>
              ) : (
                <button 
                  onClick={() => handleSelectPlan('BASIC')}
                  className="w-full py-2.5 border border-[#E2E8F0] hover:bg-slate-50 transition text-textMain font-bold text-xs rounded-xl"
                >
                  Chọn gói Cơ bản
                </button>
              )}
            </div>

            {/* Gói Chuyên Nghiệp */}
            <div className="bg-white text-textMain border-2 border-accentIndigo rounded-2xl p-7 flex flex-col justify-between relative hover:shadow-md transition">
              <span className="absolute -top-3 left-6 bg-accentIndigo text-white text-[9px] font-bold uppercase px-3 py-1 rounded-full tracking-wider shadow">
                Khuyên dùng
              </span>
              <div>
                <h4 className="font-bold text-base text-textMain mb-1">Chuyên nghiệp</h4>
                <div className="text-2xl font-extrabold text-accentIndigo mb-4">199.000đ <span className="text-xs font-normal text-textMuted">/tháng</span></div>
                <p className="text-xs text-textMuted leading-relaxed mb-6">Cho chuyên gia nghiên cứu thị trường, doanh nghiệp.</p>
                
                <ul className="flex flex-col gap-3.5 text-xs text-textMain mb-6">
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo khảo sát AI (Không giới hạn câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tạo thủ công (Không giới hạn câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="font-bold text-indigo-600">Không giới hạn kết quả phản hồi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Model vip gpt-5.4-nano, gpt-5.6-luna</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Phân tích, phục hồi lỗi câu hỏi tự động</span>
                  </li>
                </ul>
              </div>
              {userTier === 'PRO' ? (
                <button
                  disabled
                  className="w-full py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold text-xs rounded-xl cursor-not-allowed"
                >
                  ✓ Đang sử dụng gói này
                </button>
              ) : (
                <button 
                  onClick={() => handleSelectPlan('PRO')}
                  className="w-full py-2.5 bg-gradient-to-r from-accentIndigo to-accentViolet hover:opacity-90 transition text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Nâng cấp Pro
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 5. Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 px-6 text-center text-xs text-textMuted mt-auto">
        <p>© 2026 Website Survey AI. Tất cả quyền được bảo lưu.</p>
        <div className="flex justify-center gap-6 mt-3">
          <a href="#" className="hover:underline">Điều khoản dịch vụ</a>
          <a href="#" className="hover:underline">Chính sách bảo mật</a>
          <a href="#" className="hover:underline">Liên hệ hỗ trợ</a>
        </div>
      </footer>

      {/* Account Settings Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] max-w-sm w-full p-6 rounded-2xl shadow-xl animate-slide-in text-left">
            <h3 className="font-bold text-base text-textMain mb-4">Cài đặt tài khoản</h3>
            
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-textMain mb-1.5">Địa chỉ Email</label>
                <input
                  type="email"
                  disabled
                  value={session?.user?.email || ''}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg bg-slate-50 text-textMuted outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-textMain mb-1.5">Họ và tên / Tên hiển thị</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nhập tên hiển thị của bạn"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-textMain outline-none focus:border-accentIndigo transition"
                  required
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-textMain">Gói dịch vụ:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    userTier === 'PRO' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' :
                    userTier === 'BASIC' ? 'bg-blue-50 border border-blue-100 text-blue-700' :
                    'bg-slate-100 border border-slate-200 text-textMuted'
                  }`}>
                    {userTier === 'PRO' ? 'Chuyên nghiệp' : userTier === 'BASIC' ? 'Cơ bản' : 'Miễn phí'}
                  </span>
                </div>
                
                <p className="text-[10px] text-textMuted leading-relaxed">
                  {userTier === 'PRO' && 'Bạn đang sở hữu đặc quyền tối đa: Tạo file siêu dài (100 câu), sử dụng mô hình AI Chuyên nghiệp gpt-5.4-nano/gpt-5.6-luna.'}
                  {userTier === 'BASIC' && 'Hỗ trợ tạo khảo sát 40 câu hỏi. Hãy nâng cấp lên gói Chuyên nghiệp để mở khóa toàn bộ mô hình AI cao cấp gpt-5.4-nano/gpt-5.6-luna.'}
                  {userTier === 'FREE' && 'Bạn đang sử dụng gói miễn phí: bị giới hạn tối đa 15 câu hỏi và không đính kèm được tài liệu.'}
                </p>

                {userTier !== 'PRO' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountModal(false);
                      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="block text-[10px] text-accentIndigo hover:underline font-bold mt-1"
                  >
                    Nâng cấp tài khoản ngay &rarr;
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="border border-[#E2E8F0] hover:bg-slate-50 text-textMain px-4 py-2 rounded-lg font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-accentIndigo hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {isSavingProfile && <Loader2 size={12} className="animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Deletion */}
      {deleteFormId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] max-w-sm w-full p-6 rounded-2xl shadow-xl animate-slide-in">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-500 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="font-bold text-sm text-textMain mb-2">Bạn có chắc chắn muốn xóa?</h3>
            <p className="text-xs text-textMuted leading-relaxed mb-6">
              Hành động này sẽ xóa vĩnh viễn khảo sát này cùng với tất cả câu hỏi và toàn bộ câu trả lời đã thu thập. Bạn không thể hoàn tác hành động này.
            </p>
            <div className="flex justify-end gap-3 text-xs">
              <button
                onClick={() => setDeleteFormId(null)}
                className="border border-[#E2E8F0] hover:bg-slate-50 text-textMain px-4 py-2 rounded-lg font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteSurvey}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TEMPLATE INTRODUCTION & PREVIEW MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-accentIndigo flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-accentIndigo uppercase tracking-wider block">
                    {previewTemplate.badge}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                    {previewTemplate.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600 transition text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Template Info Content */}
            <div className="space-y-4 text-xs">
              {/* Introduction Card */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Info size={14} className="text-accentIndigo" />
                  Giới thiệu chi tiết mẫu:
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  {previewTemplate.fullIntro}
                </p>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl">
                  <span className="text-slate-500 block mb-0.5 font-medium">Quy mô câu hỏi:</span>
                  <strong className="text-emerald-700 font-bold text-xs">{previewTemplate.questionCount} câu hỏi mẫu + Intro</strong>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl">
                  <span className="text-slate-500 block mb-0.5 font-medium">Đối tượng phù hợp:</span>
                  <strong className="text-indigo-700 font-bold text-xs truncate block">{previewTemplate.targetAudience}</strong>
                </div>
              </div>

              {/* Sample Questions Preview */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between text-[11px]">
                  <span>Mẫu các câu hỏi tiêu biểu:</span>
                  <span className="text-slate-400 font-normal">(Hiển thị 4/{previewTemplate.questionCount} câu)</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {previewTemplate.questions.slice(1, 5).map((q: any, idx: number) => (
                    <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-xl text-[11px] text-slate-700">
                      <span className="font-bold text-accentIndigo mr-1.5">[{q.type.toUpperCase()}]</span>
                      {q.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-xs">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold px-4 py-2.5 rounded-xl transition"
              >
                Đóng
              </button>

              <button
                onClick={() => handleCreateFromTemplate(previewTemplate.name)}
                disabled={isGenerating}
                className="bg-gradient-to-r from-accentIndigo to-accentViolet hover:opacity-95 text-white font-extrabold px-5 py-2.5 rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Khởi tạo ngay mẫu 20 câu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export const dynamic = 'force-dynamic';
