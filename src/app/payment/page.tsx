'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/ToastContext';
import { ArrowLeft, CheckCircle, Loader2, CreditCard, ShieldCheck } from 'lucide-react';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [secondsLeft, setSecondsLeft] = useState(300);

  const tier = (searchParams.get('tier') || 'PRO').toUpperCase();
  const price = tier === 'BASIC' ? 79000 : 199000;
  const tierName = tier === 'BASIC' ? 'Cơ bản' : 'Chuyên nghiệp';

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast("Vui lòng đăng nhập để tiến hành thanh toán.", "error");
        router.push('/login');
      } else {
        setSession(session);
        setLoading(false);
      }
    });
  }, [supabase, router]);

  // Countdown timer
  useEffect(() => {
    if (paymentStatus !== 'pending') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPaymentStatus('failed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentStatus]);

  // Auto-simulate payment success after 8 seconds (to demonstrate webhook automation)
  useEffect(() => {
    if (loading || !session || paymentStatus !== 'pending') return;
    const timeout = setTimeout(() => {
      handleSimulateSuccess();
    }, 8000);
    return () => clearTimeout(timeout);
  }, [loading, session, paymentStatus]);

  const handleSimulateSuccess = async () => {
    try {
      const res = await fetch('/api/payment/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentStatus('success');
        toast(`Nâng cấp tài khoản lên gói ${tierName} thành công!`, "success");
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        toast(data.error || "Gặp lỗi khi đồng bộ nâng cấp tài khoản.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Lỗi kết nối đến cổng nâng cấp.", "error");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-accentIndigo animate-spin mb-4" />
        <p className="text-sm text-textMuted">Đang xác thực thông tin tài khoản...</p>
      </div>
    );
  }

  // Generate VietQR URL
  const addInfo = encodeURIComponent(`HOIYAI_${session.user.id.slice(0,8)}_${tier}`);
  const qrUrl = `https://img.vietqr.io/image/MB-123456789-compact.png?amount=${price}&addInfo=${addInfo}&accountName=HOIYAI%20PAYMENT`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center gap-4">
        <button 
          onClick={() => router.push('/')}
          className="p-1.5 hover:bg-slate-50 border border-[#E2E8F0] rounded-lg transition text-textMuted hover:text-textMain"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="font-bold text-base text-textMain">Thanh toán dịch vụ hoiyAi</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl shadow-sm p-6 text-center">
          {paymentStatus === 'pending' && (
            <>
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-semibold mb-4">
                <CreditCard size={12} />
                Cổng thanh toán tự động VietQR
              </div>

              <h2 className="text-lg font-bold text-textMain mb-1">Quét mã để nâng cấp</h2>
              <p className="text-xs text-textMuted mb-6">
                Bạn đang nâng cấp tài khoản lên gói <strong className="text-accentIndigo">{tierName}</strong>.
              </p>

              {/* VietQR Display */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 inline-block mb-6 shadow-inner relative group">
                <img 
                  src={qrUrl} 
                  alt="VietQR Code" 
                  className="w-64 h-64 object-contain rounded-lg mx-auto"
                />
                <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-2xl flex-col p-4">
                  <p className="text-xs font-bold text-textMain mb-2">Thông tin tài khoản nhận:</p>
                  <p className="text-[11px] text-textMuted">Ngân hàng: MBBank</p>
                  <p className="text-[11px] text-textMuted">Số tài khoản: 123456789</p>
                  <p className="text-[11px] text-textMuted">Số tiền: {price.toLocaleString()}đ</p>
                  <p className="text-[11px] text-textMuted font-mono mt-2 bg-slate-100 p-1 rounded">Nội dung: {session.user.id.slice(0,8)}_{tier}</p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex flex-col items-center gap-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-textMuted font-medium">
                  <Loader2 className="w-4 h-4 text-accentIndigo animate-spin" />
                  Đang kiểm tra giao dịch tự động...
                </div>
                <div className="text-lg font-mono font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-lg border border-indigo-100 animate-pulse">
                  {formatTime(secondsLeft)}
                </div>
              </div>

              <div className="text-[10px] text-textMuted leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3 mb-6 text-left">
                💡 <strong>Hệ thống giả lập thanh toán tự động:</strong> Hóa đơn sẽ tự động quét và hoàn tất sau 8 giây, hoặc bạn có thể click nút dưới đây để kích hoạt nâng cấp ngay lập tức.
              </div>

              <button
                onClick={handleSimulateSuccess}
                className="w-full py-2.5 bg-accentIndigo text-white hover:opacity-90 transition font-bold text-xs rounded-xl shadow-sm"
              >
                Xác nhận đã chuyển khoản (Giả lập)
              </button>
            </>
          )}

          {paymentStatus === 'success' && (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 text-green-500 flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle size={36} />
              </div>
              <h2 className="text-xl font-bold text-textMain mb-2">Thanh toán thành công!</h2>
              <p className="text-xs text-textMuted leading-relaxed max-w-xs mx-auto mb-6">
                Hệ thống nhận dạng VietQR tự động đã xác nhận giao dịch thành công. Tài khoản của bạn đã được nâng cấp lên gói <strong className="text-green-600 font-bold">{tierName}</strong>.
              </p>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl text-[10px] text-textMuted border border-slate-100">
                <ShieldCheck size={14} className="text-green-500" />
                Đang chuyển hướng về trang chủ...
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 text-red-500 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-xl font-bold text-textMain mb-2">Hết thời gian thanh toán</h2>
              <p className="text-xs text-textMuted max-w-xs mx-auto mb-6">
                Đã quá 5 phút mà hệ thống chưa nhận được thanh toán của bạn. Vui lòng thử lại.
              </p>
              <button
                onClick={() => {
                  setSecondsLeft(300);
                  setPaymentStatus('pending');
                }}
                className="py-2 px-6 border border-[#E2E8F0] hover:bg-slate-50 text-xs font-bold text-textMain rounded-xl"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-accentIndigo animate-spin mb-4" />
        <p className="text-sm text-textMuted">Đang tải thông tin thanh toán...</p>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
