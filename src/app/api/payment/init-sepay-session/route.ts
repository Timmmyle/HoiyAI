import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để tiếp tục thanh toán.' }, { status: 401 });
    }

    const { tier } = await req.json();
    if (!tier || (tier !== 'BASIC' && tier !== 'PRO')) {
      return NextResponse.json({ error: 'Gói cước không hợp lệ.' }, { status: 400 });
    }

    const price = tier === 'BASIC' ? 79000 : 199000;
    const userIdPrefix = session.user.id.slice(0, 8);
    const origin = req.nextUrl.origin;

    // 1. Build required SePay parameters
    const params: any = {
      merchant: process.env.SEPAY_MERCHANT_ID || '12345',
      order_invoice_number: `HOIYAI_${userIdPrefix}_${tier}_${Date.now()}`,
      order_amount: price,
      currency: 'VND',
      order_description: `HOIYAI_${userIdPrefix}_${tier}`,
      success_url: `${origin}/`,
      cancel_url: `${origin}/`
    };

    // 2. Sort keys alphabetically to generate signature query string
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

    // 3. Compute HMAC-SHA256 signature using SePay Secret Key
    const secretKey = process.env.SEPAY_SECRET_KEY || 'sepay_secret_key_abc';
    const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');

    params.signature = signature;

    // 4. Return parameters and the gateway URL to the client
    const gatewayUrl = process.env.SEPAY_GATEWAY_URL || 'https://pay-sandbox.sepay.vn/v1/checkout/init';

    return NextResponse.json({
      success: true,
      gatewayUrl,
      fields: params
    });

  } catch (err: any) {
    console.error('[SePay Session Init Error]:', err);
    return NextResponse.json({ error: err.message || 'Lỗi khởi tạo cổng thanh toán' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
