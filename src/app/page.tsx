'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, FileUp, ArrowRight, LogOut, FileSpreadsheet, Plus,
  Users, CheckCircle2, MessageSquare, Clipboard, Loader2,
  Trash2, Eye, Share2, BarChart3, Edit, Calendar, AlertTriangle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';

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
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
        .select('tier, full_name')
        .eq('id', session.user.id)
        .single();
      if (!error && data) {
        if (data.tier) setUserTier(data.tier);
        if (data.full_name) {
          setUserProfileName(data.full_name);
          setEditName(data.full_name);
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

  const handleSelectPlan = (plan: string) => {
    if (!session) {
      toast("Vui lòng đăng nhập trước khi đăng ký gói cước.", "info");
      router.push('/login');
      return;
    }
    if (plan === 'FREE') {
      toast("Tài khoản của bạn đang là gói Miễn phí.", "info");
      return;
    }
    router.push(`/payment?tier=${plan}`);
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
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
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
          title: formSchema.form_title || 'Khảo sát tạo bởi AI',
          description: formSchema.ai_summary || `Khảo sát được tạo tự động bởi mô hình AI (${result.usedModel}).`,
          questions: formSchema.questions || []
        })
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveResult.error || 'Lỗi lưu trữ khảo sát vào DB.');
      }

      toast("Tạo khảo sát thành công bằng AI!", "success");
      router.push(`/builder/${saveResult.formId}/edit`);
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Không thể tạo khảo sát.', "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick templates creation
  const handleCreateFromTemplate = async (templateName: string) => {
    if (!session) {
      toast("Vui lòng đăng nhập để lưu trữ khảo sát.", "info");
      handleLogin();
      return;
    }

    let templateQuestions: any[] = [];
    let title = '';

    if (templateName === 'Trang trắng') {
      title = 'Khảo sát chưa đặt tên';
      templateQuestions = [];
    } else if (templateName === 'Đánh giá Event') {
      title = 'Khảo sát phản hồi Sự kiện';
      templateQuestions = [
        { type: 'radio', text: 'Bạn cảm nhận như thế nào về sự kiện này?', options: ['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Không hài lòng'], is_branching: false },
        { type: 'checkbox', text: 'Hoạt động nào bạn thấy ấn tượng nhất? (Chọn nhiều)', options: ['Nội dung chia sẻ', 'Thời gian tổ chức', 'Hậu cần & tiệc ngọt', 'Hoạt động networking'], is_branching: false },
        { type: 'voice', text: 'Ý kiến đóng góp thêm của bạn (nói hoặc gõ tiếng Việt)', options: [], is_branching: false }
      ];
    } else if (templateName === 'Khảo sát KH') {
      title = 'Khảo sát mức độ hài lòng khách hàng';
      templateQuestions = [
        { type: 'radio', text: 'Bạn có muốn tiếp tục sử dụng dịch vụ của chúng tôi không?', options: ['Có, chắc chắn', 'Không, cảm ơn'], is_branching: true, id: 'q1' },
        { type: 'textarea', text: 'Lý do bạn không muốn sử dụng dịch vụ?', options: [], visibility: { condition_question_id: 'q1', condition_value: 'Không, cảm ơn' } },
        { type: 'scale', text: 'Đánh giá chất lượng phục vụ của chúng tôi', options: [], is_branching: false }
      ];
    } else {
      title = 'Khảo sát ý kiến nhân viên';
      templateQuestions = [
        { type: 'scale', text: 'Môi trường làm việc thân thiện, hòa đồng?', options: [], is_branching: false },
        { type: 'radio', text: 'Bạn thuộc bộ phận nào?', options: ['Kỹ thuật', 'Kinh doanh', 'Nhân sự', 'Marketing'], is_branching: false }
      ];
    }

    setIsGenerating(true);
    try {
      const saveRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: 'Mẫu khảo sát khởi tạo nhanh.',
          questions: templateQuestions
        })
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveResult.error);

      toast(`Khởi tạo mẫu ${templateName} thành công.`, "success");
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
    <div className="flex-1 flex flex-col">
      {/* 1. Header / Navbar */}
      <header className="border-b border-[#E2E8F0] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="hoiyAi Logo" className="h-11 w-11 object-contain rounded-lg border border-slate-100" />
          <span className="font-extrabold text-xl text-textMain tracking-wide">HoiyAI</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-textMuted">
          <a href="#features" className="hover:text-textMain transition">Tính năng</a>
          <a href="#aichat" className="hover:text-textMain transition">AI Chat</a>
          <a href="#pricing" className="hover:text-textMain transition">Bảng giá</a>
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
                <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-accentIndigo flex items-center justify-center text-xs font-bold font-mono">
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
              className="bg-textMain hover:bg-slate-800 transition text-white px-4 py-2 rounded text-xs font-bold"
            >
              Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero & AI Prompt Box Center */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Sparkles size={14} />
            Hệ thống tạo khảo sát thông minh AI
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-textMain">
            Tạo khảo sát chuyên nghiệp trong vài giây
          </h1>
          <p className="text-sm text-textMuted max-w-lg mx-auto leading-relaxed">
            Nhập prompt mong muốn hoặc kéo thả tài liệu Word, PDF hay hình ảnh vào ô bên dưới. AI sẽ tự động sinh form, phân nhánh và dịch giọng nói.
          </p>
        </div>

        {/* AI Center Box */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`w-full bg-white rounded-xl border-2 transition-all p-5 shadow-sm flex flex-col relative ${dragActive ? 'border-accentIndigo bg-indigo-50/20' : 'border-[#E2E8F0]'
            }`}
        >
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-pulse">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-100 border-t-accentIndigo animate-spin" />
                <Sparkles className="absolute inset-0 m-auto text-accentIndigo animate-bounce" size={18} />
              </div>
              <h3 className="font-bold text-xs text-textMain mb-1">
                AI đang tạo khảo sát của bạn...
              </h3>
              <p className="text-[10px] text-textMuted max-w-sm leading-relaxed px-4">
                Hệ thống đang chạy qua chuỗi tự động cấu trúc phân mảnh nâng cao (gpt-5.4-nano &rarr; gpt-5.6-luna &rarr; gpt-5-mini &rarr; gpt-5-nano). Quá trình này có thể mất vài giây, vui lòng không tắt trình duyệt.
              </p>
            </div>
          ) : (
            <>
              {/* Text Area */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='Ví dụ: "Tạo khảo sát đo lường chất lượng phục vụ của cửa hàng F&B. Chia làm 2 nhóm khách hàng mua mang đi và ăn tại chỗ..."'
                rows={4}
                className="w-full text-sm outline-none resize-none border-0 placeholder-slate-400 bg-transparent text-textMain mb-4"
              />

              {/* Progress / Status bars */}
              {(isParsingFile || ocrProgress) && (
                <div className="mb-4 bg-slate-50 border border-[#E2E8F0] p-3 rounded flex items-center gap-3 text-xs text-textMuted">
                  <Loader2 size={16} className="animate-spin text-accentIndigo" />
                  <span>
                    {isParsingFile && "Đang giải nén văn bản từ tệp..."}
                    {ocrProgress && ocrProgress}
                  </span>
                </div>
              )}

              {/* Action Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#F1F5F9] pt-4 gap-4">
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
                    className={`flex items-center gap-2 text-xs border border-[#E2E8F0] transition px-3 py-2 rounded font-semibold bg-white ${userTier === 'FREE' ? 'cursor-not-allowed opacity-70 text-slate-400' : 'hover:border-accentIndigo hover:text-accentIndigo text-textMuted'}`}
                  >
                    <FileUp size={14} />
                    Đính kèm File (.pdf, .docx, .png) {userTier === 'FREE' && '🔒'}
                  </button>
                </div>

                <button
                  onClick={handleGenerateSurvey}
                  disabled={isParsingFile || !!ocrProgress}
                  className="bg-gradient-to-r from-accentIndigo to-accentViolet text-white hover:opacity-90 transition px-5 py-2 rounded text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  Tạo Survey bằng AI
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 3. Template strip */}
        <div className="w-full mt-12">
          <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-4 text-left">
            Tạo Nhanh (Templates)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[
              { name: 'Trang trắng', icon: Plus, desc: 'Bắt đầu từ con số không' },
              { name: 'Đánh giá Event', icon: CheckCircle2, desc: 'Phản hồi sau sự kiện' },
              { name: 'Khảo sát KH', icon: Users, desc: 'Khảo sát khách hàng' },
              { name: 'Nhân sự', icon: FileSpreadsheet, desc: 'Thu thập ý kiến nội bộ' }
            ].map((tmpl, idx) => (
              <button
                key={idx}
                onClick={() => handleCreateFromTemplate(tmpl.name)}
                disabled={isGenerating}
                className="bg-white hover:border-accentIndigo hover:shadow-md transition text-left border border-[#E2E8F0] p-4 rounded-xl shadow-sm flex flex-col items-start"
              >
                <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-textMuted mb-3 border border-[#E2E8F0]">
                  <tmpl.icon size={16} />
                </div>
                <div className="font-semibold text-xs text-textMain mb-1">{tmpl.name}</div>
                <div className="text-[10px] text-textMuted leading-tight">{tmpl.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Khảo sát của bạn (My Surveys) */}
        {session && (
          <div className="w-full mt-12 text-left">
            <div className="flex items-center justify-between mb-4 border-b border-[#E2E8F0] pb-2">
              <h2 className="text-xs font-bold text-textMuted uppercase tracking-wider">
                Khảo sát của bạn ({mySurveys.length})
              </h2>
              <button
                onClick={fetchMySurveys}
                className="text-[10px] text-accentIndigo hover:underline font-bold"
              >
                Làm mới danh sách
              </button>
            </div>

            {loadingSurveys ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-textMuted bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
                <Loader2 size={14} className="animate-spin text-accentIndigo" />
                Đang tải danh sách khảo sát...
              </div>
            ) : mySurveys.length === 0 ? (
              <div className="py-12 text-center text-xs text-textMuted bg-white border border-dashed border-[#E2E8F0] rounded-xl shadow-sm">
                Bạn chưa tạo khảo sát nào. Hãy nhập mô tả ở ô phía trên hoặc chọn một mẫu tạo nhanh để bắt đầu!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {mySurveys.map((form) => (
                  <div
                    key={form.id}
                    className="bg-white border border-[#E2E8F0] hover:border-slate-300 hover:shadow-md transition p-5 rounded-xl shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-accentIndigo uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded">
                          Khảo sát
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
                    <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/builder/${form.id}/edit`)}
                          className="flex items-center gap-1 border border-[#E2E8F0] hover:bg-slate-50 text-[10px] text-textMain px-2.5 py-1.5 rounded-lg transition font-semibold"
                          title="Chỉnh sửa form"
                        >
                          <Edit size={10} />
                          Sửa
                        </button>

                        <button
                          onClick={() => router.push(`/analytics/${form.id}`)}
                          className="flex items-center gap-1 border border-[#E2E8F0] hover:bg-slate-50 text-[10px] text-textMain px-2.5 py-1.5 rounded-lg transition font-semibold"
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
                    <span>Tạo khảo sát AI (tối đa 15 câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Model gpt-5-nano và gemini</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Trình kéo thả cơ bản</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-400 font-bold">✗</span>
                    <span className="text-textMuted line-through">File tài liệu dài</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => handleSelectPlan('FREE')}
                className="w-full py-2.5 border border-[#E2E8F0] hover:bg-slate-50 transition text-textMain font-bold text-xs rounded-xl"
              >
                Bắt đầu ngay
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
                    <span>Tạo khảo sát AI (tối đa 40 câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Nhập tài liệu vừa (đến 30 câu)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Xuất kết quả Excel, CSV</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Hỗ trợ qua email</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => handleSelectPlan('BASIC')}
                className="w-full py-2.5 border border-[#E2E8F0] hover:bg-slate-50 transition text-textMain font-bold text-xs rounded-xl"
              >
                Chọn gói Cơ bản
              </button>
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
                    <span>Tối đa 100 câu hỏi khảo sát</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Model trả phí gpt-5.4-nano, gpt-5.6-luna</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Tự động phát hiện, phục hồi lỗi câu hỏi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Lưu trữ siêu tốc, bảo vệ dữ liệu 100%</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => handleSelectPlan('PRO')}
                className="w-full py-2.5 bg-gradient-to-r from-accentIndigo to-accentViolet hover:opacity-90 transition text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Nâng cấp Pro
              </button>
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
    </div>
  );
}
export const dynamic = 'force-dynamic';
