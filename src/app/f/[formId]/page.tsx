'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, ChevronRight, ChevronLeft, Send, CheckCircle2, 
  Loader2, Play, Volume2, AlertCircle, FileAudio, RotateCcw, Video
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string | null;
  topic?: string | null;
}

export default function ResponderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  
  const formId = params.formId as string;
  const isPreview = searchParams.get('preview') === 'true';

  // State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isQuiz, setIsQuiz] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({});
  const [audioBlobs, setAudioBlobs] = useState<{ [questionId: string]: Blob }>({});
  const [audioUrls, setAudioUrls] = useState<{ [questionId: string]: string }>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // Video recording states
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoRecordRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  // Helper to ensure checkbox selections are always resolved as array of strings
  const getCheckboxArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return [trimmed];
        }
      }
      return trimmed ? [trimmed] : [];
    }
    return [String(val)];
  };

  const parseCheckboxCorrectAnswer = (val: any) => {
    let min = 1;
    let correct: string[] = [];
    if (val) {
      if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          min = parsed.min || 1;
          const c = parsed.correct;
          if (Array.isArray(c)) correct = c;
          else if (c) correct = [c];
        } catch {}
      } else {
        if (/^\d+$/.test(val)) min = parseInt(val, 10);
        else correct = [val];
      }
    }
    return { min, correct };
  };

  // Load Form Data
  useEffect(() => {
    const loadForm = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/forms?id=${formId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        setFormTitle(data.form.title);
        setFormDescription(data.form.description || '');
        setIsQuiz(data.form.is_quiz || false);
        setQuestions(data.questions || []);
      } catch (err: any) {
        toast(err.message || 'Lỗi tải biểu mẫu khảo sát.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (formId) {
      loadForm();
    }
  }, [formId]);

  // Web Speech API initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = 'vi-VN';
        rec.interimResults = true;
        rec.continuous = true;

        rec.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          setSpeechText(currentText);
          
          // Update the answer in real-time
          if (questions[activeIdx]) {
            handleAnswerChange(questions[activeIdx].id, currentText);
          }
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error:', e.error);
        };

        recognitionRef.current = rec;
      }
    }
  }, [questions, activeIdx]);

  // Helper: determine if question is visible based on conditional logic
  const isQuestionVisible = (q: Question) => {
    if (q.visibility_type === 'always') return true;
    if (!q.condition_question_id || !q.condition_value) return true;

    // Check what the user selected in the condition question
    const conditionAnswer = answers[q.condition_question_id];
    return conditionAnswer === q.condition_value;
  };

  // Find next visible question index
  const getNextIdx = (curr: number) => {
    let next = curr + 1;
    while (next < questions.length) {
      if (isQuestionVisible(questions[next])) {
        return next;
      }
      next++;
    }
    return -1; // No next questions
  };

  // Find previous visible question index
  const getPrevIdx = (curr: number) => {
    let prev = curr - 1;
    while (prev >= 0) {
      if (isQuestionVisible(questions[prev])) {
        return prev;
      }
      prev--;
    }
    return -1; // No previous questions
  };

  const handleNext = () => {
    const currentQ = questions[activeIdx];
    
    // Check required check (skip for info type)
    const isAnsEmpty = currentQ.type === 'checkbox' 
      ? getCheckboxArray(answers[currentQ.id]).length === 0
      : (!answers[currentQ.id] || String(answers[currentQ.id]).trim() === '');

    if (currentQ.type !== 'info' && currentQ.is_required && isAnsEmpty) {
      toast("Câu hỏi này là bắt buộc. Vui lòng trả lời.", 'error');
      return;
    }

    // Check minimum choices requirement for checkboxes
    if (currentQ.type === 'checkbox') {
      const val = currentQ.correct_answer;
      let minRequired = 1;
      if (val && val.trim().startsWith('{')) {
        try {
          minRequired = JSON.parse(val).min || 1;
        } catch {}
      } else if (val && /^\d+$/.test(val)) {
        minRequired = parseInt(val, 10);
      }

      const selectedAnswers = getCheckboxArray(answers[currentQ.id]);
      const hasAnswered = selectedAnswers.length > 0;
      
      if (currentQ.is_required || hasAnswered) {
        if (selectedAnswers.length < minRequired) {
          toast(`Vui lòng chọn tối thiểu ${minRequired} đáp án.`, 'error');
          return;
        }
      }
    }

    const next = getNextIdx(activeIdx);
    if (next !== -1) {
      setActiveIdx(next);
      setSpeechText(answers[questions[next].id] || '');
    }
  };

  const handlePrev = () => {
    const prev = getPrevIdx(activeIdx);
    if (prev !== -1) {
      setActiveIdx(prev);
      setSpeechText(answers[questions[prev].id] || '');
    }
  };

  const handleAnswerChange = (qId: string, val: any) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  // Voice recording handlers (Speech Recognition + Audio Recording)
  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    audioChunksRef.current = [];

    // 1. Web Speech STT
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('STT recognition already running or error:', e);
      }
    }

    // 2. Audio file recorder (for Supabase Storage)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const qId = questions[activeIdx].id;
        
        // Save blob
        setAudioBlobs(prev => ({ ...prev, [qId]: audioBlob }));
        
        // Generate local audio player preview
        const url = URL.createObjectURL(audioBlob);
        setAudioUrls(prev => ({ ...prev, [qId]: url }));

        // Stop micro stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      console.warn("Không thể truy cập microphone để ghi âm file âm thanh:", err);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);

    // Stop Web Speech STT
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Video recording handlers (Speech Recognition + Video Recording)
  const startVideoRecording = async () => {
    if (isRecordingVideo) return;
    setVideoUrl(null);
    videoChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 360, facingMode: 'user' }, 
        audio: true 
      });
      
      setVideoStream(stream);
      
      // Delay source allocation to allow DOM element to render
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.muted = true;
          videoPreviewRef.current.play().catch(err => console.warn("Failed to auto-play video preview stream:", err));
        }
      }, 100);

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      videoRecordRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const qId = questions[activeIdx].id;
        
        setAudioBlobs(prev => ({ ...prev, [qId]: videoBlob }));
        
        const url = URL.createObjectURL(videoBlob);
        setAudioUrls(prev => ({ ...prev, [qId]: url }));
        setVideoUrl(url);

        stream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      };

      recorder.start();
      setIsRecordingVideo(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      toast("Không thể truy cập camera và microphone. Vui lòng cấp quyền trong cài đặt.", "error");
    }
  };

  const stopVideoRecording = () => {
    if (!isRecordingVideo) return;
    setIsRecordingVideo(false);
    
    if (videoRecordRecorderRef.current && videoRecordRecorderRef.current.state !== 'inactive') {
      videoRecordRecorderRef.current.stop();
    }
  };

  // Stop active camera stream when question changes
  useEffect(() => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setIsRecordingVideo(false);
    setVideoUrl(null);
  }, [activeIdx]);

  // Form Submission
  const handleSubmit = async () => {
    if (isPreview) {
      toast("Đây là chế độ xem trước. Kết quả trả lời sẽ không được gửi thực sự.", 'info');
      setIsSubmitted(true);
      return;
    }

    // Double check active question constraints before submitting
    const currentQ = questions[activeIdx];
    if (currentQ) {
      const isAnsEmpty = currentQ.type === 'checkbox' 
        ? getCheckboxArray(answers[currentQ.id]).length === 0
        : (!answers[currentQ.id] || String(answers[currentQ.id]).trim() === '');

      if (currentQ.type !== 'info' && currentQ.is_required && isAnsEmpty) {
        toast("Câu hỏi hiện tại là bắt buộc.", 'error');
        return;
      }

      if (currentQ.type === 'checkbox') {
        const val = currentQ.correct_answer;
        let minRequired = 1;
        if (val && val.trim().startsWith('{')) {
          try {
            minRequired = JSON.parse(val).min || 1;
          } catch {}
        } else if (val && /^\d+$/.test(val)) {
          minRequired = parseInt(val, 10);
        }

        const selectedAnswers = getCheckboxArray(answers[currentQ.id]);
        const hasAnswered = selectedAnswers.length > 0;
        
        if (currentQ.is_required || hasAnswered) {
          if (selectedAnswers.length < minRequired) {
            toast(`Vui lòng chọn tối thiểu ${minRequired} đáp án.`, 'error');
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    try {
      const answersList = [];

      // Loop through questions and assemble answers (only for visible questions)
      for (const q of questions) {
        if (isQuestionVisible(q)) {
          let audioUrl = null;

          // If there is a recorded audio blob for this question, upload it to Supabase Storage
          const blob = audioBlobs[q.id];
          if (blob) {
            const isVideo = blob.type.includes('video');
            const fileExt = isVideo ? 'webm' : 'wav';
            const contentType = isVideo ? 'video/webm' : 'audio/wav';
            
            const fileName = `${formId}/${Date.now()}-${q.id}.${fileExt}`;
            const { data, error: uploadError } = await supabase.storage
              .from('survey-recordings')
              .upload(fileName, blob, { contentType });

            if (uploadError) {
              console.error("Storage upload error:", uploadError.message);
            } else if (data) {
              // Construct public URL
              const { data: publicUrlData } = supabase.storage
                .from('survey-recordings')
                .getPublicUrl(fileName);
              audioUrl = publicUrlData?.publicUrl;
            }
          }

          answersList.push({
            questionId: q.id,
            value: answers[q.id] || '',
            audioUrl
          });
        }
      }

      // Submit responses API
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          answers: answersList
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setIsSubmitted(true);
      toast("Đã nộp phản hồi khảo sát thành công!", "success");
    } catch (err: any) {
      toast(`Lỗi nộp khảo sát: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-xs text-textMuted">
          <Loader2 className="animate-spin text-accentIndigo" />
          Đang tải khảo sát...
        </div>
      </div>
    );
  }

  // Submitted Screen
  if (isSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-xl font-bold text-textMain mb-2">Cảm ơn bạn đã phản hồi!</h1>
        <p className="text-xs text-textMuted leading-relaxed mb-6">
          Ý kiến của bạn đã được ghi nhận và lưu trữ vào hệ thống phân tích. Bạn có thể đóng tab hoặc trình duyệt này bất cứ lúc nào.
        </p>
        <button
          onClick={() => router.push('/')}
          className="border border-[#E2E8F0] hover:bg-slate-50 transition px-4 py-2 rounded text-xs font-semibold"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  const activeQuestion = questions[activeIdx];
  const isLastQuestion = getNextIdx(activeIdx) === -1;
  const isFirstQuestion = getPrevIdx(activeIdx) === -1;

  // Calculate progress percentage based on current position and visible questions
  const totalVisibleQs = questions.filter(isQuestionVisible).length;
  const visibleIndex = questions.filter(isQuestionVisible).findIndex(q => q.id === activeQuestion?.id);
  const progressPercent = totalVisibleQs > 0 ? Math.round(((visibleIndex + 1) / totalVisibleQs) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col max-w-xl w-full mx-auto px-6 py-12 justify-center">
      {/* 1. Header / Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">
          <span>{formTitle}</span>
          <span>{progressPercent}% Hoàn thành</span>
        </div>
        <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-accentIndigo to-accentViolet transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Typeform-style Question Card */}
      {activeQuestion ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 shadow-sm flex-1 flex flex-col justify-between min-h-[360px]">
          <div>
            {/* Index & Title */}
            <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">
              Câu hỏi {visibleIndex + 1} của {totalVisibleQs}
              {activeQuestion.is_required && <span className="text-red-500 ml-1">* Bắt buộc</span>}
            </div>
            
            <h2 className="text-sm font-bold text-textMain leading-relaxed mb-6 whitespace-pre-wrap">
              {activeQuestion.text}
            </h2>

            {/* Answer Input Renderings */}
            <div className="my-6">
              {/* Radio (Multiple Choice 1 Answer) */}
              {['radio', 'quiz_radio'].includes(activeQuestion.type) && (
                <div className="flex flex-col gap-2.5">
                  {activeQuestion.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswerChange(activeQuestion.id, opt)}
                      className={`flex items-center gap-3 w-full border text-left p-3.5 rounded-xl transition text-xs font-semibold ${
                        answers[activeQuestion.id] === opt
                          ? 'border-accentIndigo bg-indigo-50/20 text-accentIndigo'
                          : 'border-[#E2E8F0] hover:border-slate-300 text-textMain'
                      }`}
                    >
                      <div className={`w-4 h-4 border flex items-center justify-center rounded-full ${
                        answers[activeQuestion.id] === opt
                          ? 'border-accentIndigo'
                          : 'border-slate-300'
                      }`}>
                        {answers[activeQuestion.id] === opt && (
                          <div className="w-2 h-2 rounded-full bg-accentIndigo" />
                        )}
                      </div>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Checkbox (Multi Choice) */}
              {activeQuestion.type === 'checkbox' && (
                <div className="flex flex-col gap-2.5">
                  {activeQuestion.options.map((opt, oIdx) => {
                    const currentSel = getCheckboxArray(answers[activeQuestion.id]);
                    const isSelected = currentSel.includes(opt);

                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          const nextSel = isSelected
                            ? currentSel.filter((s: string) => s !== opt)
                            : [...currentSel, opt];
                          handleAnswerChange(activeQuestion.id, nextSel);
                        }}
                        className={`flex items-center gap-3 w-full border text-left p-3.5 rounded-xl transition text-xs font-semibold ${
                          isSelected
                            ? 'border-accentIndigo bg-indigo-50/20 text-accentIndigo'
                            : 'border-[#E2E8F0] hover:border-slate-300 text-textMain'
                        }`}
                      >
                        <div className={`w-4 h-4 border flex items-center justify-center rounded ${
                          isSelected ? 'border-accentIndigo bg-accentIndigo text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <span className="text-[9px]">✓</span>}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text Input */}
              {activeQuestion.type === 'text' && (
                <input
                  type="text"
                  value={answers[activeQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                  className="w-full border border-[#E2E8F0] focus:border-accentIndigo rounded-xl p-3 text-xs outline-none bg-transparent"
                  placeholder="Nhập câu trả lời của bạn..."
                />
              )}

              {/* Textarea */}
              {activeQuestion.type === 'textarea' && (
                <textarea
                  value={answers[activeQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                  rows={4}
                  className="w-full border border-[#E2E8F0] focus:border-accentIndigo rounded-xl p-3 text-xs outline-none bg-transparent resize-none"
                  placeholder="Viết câu trả lời chi tiết tại đây..."
                />
              )}

              {/* Video Recording & Camera Interview */}
              {activeQuestion.type === 'video' && (
                <div className="flex flex-col gap-4">
                  <div className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden border border-[#E2E8F0] shadow-sm flex items-center justify-center">
                    {/* Live stream */}
                    {videoStream && (
                      <video 
                        ref={videoPreviewRef} 
                        className="w-full h-full object-cover"
                        playsInline
                      />
                    )}
                    
                    {/* Review playback */}
                    {!videoStream && audioUrls[activeQuestion.id] && (
                      <video 
                        src={audioUrls[activeQuestion.id]} 
                        controls 
                        className="w-full h-full object-contain"
                        playsInline
                      />
                    )}
                    
                    {/* Empty placeholder */}
                    {!videoStream && !audioUrls[activeQuestion.id] && (
                      <div className="text-center text-textMuted flex flex-col items-center gap-2 px-6">
                        <Video size={36} className="text-slate-400" />
                        <span className="text-[11px]">Nhấp nút bên dưới để cấp quyền và bắt đầu ghi hình phỏng vấn.</span>
                      </div>
                    )}

                    {/* REC indicator */}
                    {isRecordingVideo && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                        REC
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-center gap-3">
                    {isRecordingVideo ? (
                      <button
                        type="button"
                        onClick={stopVideoRecording}
                        className="bg-red-500 hover:bg-red-600 transition text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm"
                      >
                        Dừng ghi hình
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startVideoRecording}
                        className="bg-gradient-to-tr from-accentIndigo to-accentViolet hover:opacity-90 transition text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
                      >
                        <Video size={14} />
                        {audioUrls[activeQuestion.id] ? 'Ghi hình lại' : 'Bắt đầu ghi hình'}
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-textMuted text-center leading-relaxed max-w-sm mx-auto">
                    Video phỏng vấn của bạn sẽ được nộp tự động cùng bài khảo sát.
                  </p>
                </div>
              )}

              {/* Voice Answer with Wave Animation and local player */}
              {activeQuestion.type === 'voice' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-md ${
                        isRecording 
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                          : 'bg-gradient-to-tr from-accentIndigo to-accentViolet hover:opacity-90'
                      }`}
                    >
                      {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-textMuted uppercase mb-1">
                        {isRecording ? 'Đang ghi âm (Hãy nói tiếng Việt)...' : 'Bấm nút để nói'}
                      </div>
                      
                      {isRecording ? (
                        <div className="voice-wave">
                          <div className="voice-wave-bar" />
                          <div className="voice-wave-bar" />
                          <div className="voice-wave-bar" />
                          <div className="voice-wave-bar" />
                          <div className="voice-wave-bar" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-textMuted leading-tight block">
                          Microphone sẽ nhận diện giọng nói và điền tự động bên dưới.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Textarea showing recognized text in real time */}
                  <textarea
                    value={answers[activeQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                    rows={3}
                    className="w-full border border-[#E2E8F0] focus:border-accentIndigo rounded-xl p-3 text-xs outline-none bg-transparent resize-none"
                    placeholder="Chữ dịch từ giọng nói sẽ hiển thị tại đây. Bạn vẫn có thể chỉnh sửa thủ công..."
                  />

                  {/* Local audio playback if recorded */}
                  {audioUrls[activeQuestion.id] && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-[#E2E8F0] p-2.5 rounded-lg text-[10px]">
                      <FileAudio size={14} className="text-accentIndigo" />
                      <span className="font-semibold text-textMain flex-1">Bản ghi âm đã sẵn sàng</span>
                      <audio src={audioUrls[activeQuestion.id]} controls className="h-6 w-36" />
                    </div>
                  )}
                </div>
              )}

              {/* Rating Scale */}
              {activeQuestion.type === 'scale' && (
                <div className="flex justify-between items-center border border-[#E2E8F0] p-5 rounded-xl bg-slate-50/20">
                  <span className="text-[10px] font-bold text-textMuted">Kém</span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => handleAnswerChange(activeQuestion.id, val.toString())}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs transition ${
                          answers[activeQuestion.id] === val.toString()
                            ? 'bg-accentIndigo text-white border-accentIndigo'
                            : 'bg-white border-[#E2E8F0] text-textMain hover:border-slate-300'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-textMuted">Tốt</span>
                </div>
              )}

              {/* Dropdown */}
              {activeQuestion.type === 'dropdown' && (
                <select
                  value={answers[activeQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl p-3 text-xs outline-none bg-white text-textMain"
                >
                  <option value="">-- Chọn một đáp án --</option>
                  {activeQuestion.options.map((opt, oIdx) => (
                    <option key={oIdx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* Giới thiệu / Ghi chú (Info) */}
              {activeQuestion.type === 'info' && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="bg-indigo-50 text-accentIndigo p-4 rounded-full">
                    <AlertCircle size={32} />
                  </div>
                  <p className="text-xs text-textMuted text-center max-w-sm leading-relaxed">
                    Vui lòng bấm nút bên dưới để chuyển tiếp sang phần câu hỏi.
                  </p>
                  <button
                    onClick={isLastQuestion ? handleSubmit : handleNext}
                    className="w-full max-w-xs bg-gradient-to-r from-accentIndigo to-accentViolet text-white hover:opacity-90 px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md"
                  >
                    {isLastQuestion ? 'Nộp khảo sát' : 'Tiếp tục'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Date */}
              {activeQuestion.type === 'date' && (
                <input
                  type="date"
                  value={answers[activeQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                  className="w-full border border-[#E2E8F0] focus:border-accentIndigo rounded-xl p-3 text-xs outline-none bg-white text-textMain"
                />
              )}

              {/* File Upload Attachment Placeholder */}
              {activeQuestion.type === 'file' && (
                <div className="border border-dashed border-[#E2E8F0] p-6 rounded-xl text-center bg-slate-50/10">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAnswerChange(activeQuestion.id, e.target.files[0].name);
                      }
                    }}
                    className="hidden"
                    id={`file-input-${activeQuestion.id}`}
                  />
                  <label
                    htmlFor={`file-input-${activeQuestion.id}`}
                    className="cursor-pointer inline-flex items-center gap-2 text-xs border border-[#E2E8F0] bg-white hover:bg-slate-50 px-4 py-2 rounded-lg font-semibold text-textMuted shadow-sm"
                  >
                    Chọn file tải lên
                  </label>
                  <div className="text-[9px] text-textMuted mt-2">
                    {answers[activeQuestion.id] ? `Đã chọn: ${answers[activeQuestion.id]}` : 'Hỗ trợ PDF, DOCX, Hình ảnh kích thước < 5MB'}
                  </div>
                </div>
              )}

              {/* Practice Mode Feedback Card */}
              {isQuiz && answers[activeQuestion.id] && (
                <div className="mt-6 pt-4 border-t border-slate-100 animate-fade-in">
                  {(() => {
                    const userAns = answers[activeQuestion.id];
                    let isCorrect = false;

                    if (activeQuestion.type === 'checkbox') {
                      const { correct } = parseCheckboxCorrectAnswer(activeQuestion.correct_answer);
                      const userArr = getCheckboxArray(userAns);
                      isCorrect = correct.length > 0 && correct.every((c: string) => userArr.includes(c)) && userArr.length === correct.length;
                    } else {
                      isCorrect = String(userAns).trim().toLowerCase() === String(activeQuestion.correct_answer || '').trim().toLowerCase();
                    }

                    return (
                      <div className={`p-4 rounded-2xl border ${
                        isCorrect ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
                      }`}>
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <span>{isCorrect ? '✓ Đáp án chính xác!' : '✕ Chưa chính xác!'}</span>
                        </div>
                        {activeQuestion.explanation && (
                          <p className="text-[11px] mt-1 leading-relaxed opacity-90">
                            💡 <strong>Giải thích:</strong> {activeQuestion.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Control Area */}
          <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-4 mt-6">
            <button
              onClick={handlePrev}
              disabled={isFirstQuestion}
              className="flex items-center gap-1 text-xs text-textMuted hover:text-textMain disabled:opacity-30 transition font-bold py-2"
            >
              <ChevronLeft size={16} />
              Quay lại
            </button>

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-accentIndigo to-accentViolet text-white hover:opacity-90 px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Nộp khảo sát
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="bg-textMain hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                Tiếp theo
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-xs text-textMuted">
          Mẫu khảo sát không có câu hỏi nào để hiển thị.
        </div>
      )}
    </div>
  );
}
export const dynamic = 'force-dynamic';
