import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Get active session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để thực hiện thanh toán.' }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = body;

    if (!tier || !['FREE', 'BASIC', 'PRO'].includes(tier)) {
      return NextResponse.json({ error: 'Cấp độ (tier) không hợp lệ.' }, { status: 400 });
    }

    const userId = session.user.id;

    // Upgrade user tier in profiles
    // We use the server client to update the profiles table
    // Since the service role is not used, the user can update their own profile if RLS permits.
    // Wait, let's check schema.sql: "Users can update their own profile on public.profiles for update using (auth.uid() = id)"
    // So the user's browser client/auth session CAN update their own profile row!
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days subscription

    const { error } = await supabase
      .from('profiles')
      .update({ 
        tier, 
        tier_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user tier:', error);
      return NextResponse.json({ error: `Lỗi cập nhật CSDL: ${error.message}. Vui lòng chạy file SQL migration trong Supabase Dashboard.` }, { status: 500 });
    }

    return NextResponse.json({ success: true, tier });
  } catch (err: any) {
    console.error('Upgrade API crashed:', err);
    return NextResponse.json({ error: err.message || 'Lỗi hệ thống.' }, { status: 500 });
  }
}
