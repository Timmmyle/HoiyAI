'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast("Vui lòng điền đầy đủ email và mật khẩu.", "error");
      return;
    }

    if (password.length < 6) {
      toast("Mật khẩu phải có độ dài tối thiểu 6 ký tự.", "error");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        
        toast("Đăng ký thành công! Bạn có thể đăng nhập ngay.", "success");
        setIsSignUp(false);
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast("Đăng nhập thành công!", "success");
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      toast(err.message || "Đã xảy ra lỗi khi xác thực.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-background min-h-screen">
      <button 
        onClick={() => router.push('/')}
        className="mb-8 flex items-center gap-1.5 text-xs text-textMuted hover:text-textMain transition font-semibold"
      >
        <ArrowLeft size={14} />
        Quay lại trang chủ
      </button>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E2E8F0] p-8 shadow-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold mb-3">
            <Sparkles size={12} />
            Mustring.com
          </div>
          <h1 className="text-lg font-bold text-textMain">
            {isSignUp ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}
          </h1>
          <p className="text-[10px] text-textMuted mt-1">
            {isSignUp 
              ? 'Tạo tài khoản để thiết kế và quản lý khảo sát thông minh' 
              : 'Đăng nhập để truy cập trang builder và kết quả khảo sát'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-textMuted uppercase">Địa chỉ Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 text-textMuted" size={14} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@viethan.com"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E2E8F0] focus:border-accentIndigo text-xs outline-none bg-transparent text-textMain"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-textMuted uppercase">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-textMuted" size={14} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E2E8F0] focus:border-accentIndigo text-xs outline-none bg-transparent text-textMain"
                required
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-accentIndigo to-accentViolet text-white hover:opacity-90 transition py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isSignUp ? (
              'Đăng ký ngay'
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center mt-6 pt-4 border-t border-[#F1F5F9] text-[10px] text-textMuted">
          {isSignUp ? (
            <span>
              Đã có tài khoản?{' '}
              <button 
                onClick={() => setIsSignUp(false)}
                className="font-bold text-accentIndigo hover:underline"
              >
                Đăng nhập tại đây
              </button>
            </span>
          ) : (
            <span>
              Chưa có tài khoản?{' '}
              <button 
                onClick={() => setIsSignUp(true)}
                className="font-bold text-accentIndigo hover:underline"
              >
                Đăng ký tài khoản mới
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
