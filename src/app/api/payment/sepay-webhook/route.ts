import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use the service role key to bypass RLS since webhooks run server-side outside user auth context
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify SePay API webhook authorization token
    const authHeader = req.headers.get('Authorization');
    const expectedToken = process.env.SEPAY_WEBHOOK_TOKEN || 'sepay_secret_token_123';
    
    if (!authHeader || authHeader !== `Apikey ${expectedToken}`) {
      console.warn('[SePay Webhook] Unauthorized request attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload body
    const body = await req.json();
    console.log('[SePay Webhook] Received webhook payload:', body);

    const amountIn = body.amount_in !== undefined ? body.amount_in : body.amountIn;
    const content = body.content || body.transfer_content;
    const transactionId = body.id || body.transaction_id;

    if (!content) {
      return NextResponse.json({ error: 'Missing content field (nội dung chuyển khoản)' }, { status: 400 });
    }

    // 3. Extract user ID prefix and target tier from memo content
    // VietQR content format: HOIYAI_[idPrefix]_[TIER]
    const match = content.match(/HOIYAI_([a-f0-9]{8})_(BASIC|PRO)/i);
    if (!match) {
      console.log(`[SePay Webhook] Memo content "${content}" does not match hoiyAi format. Skipping.`);
      return NextResponse.json({ success: true, message: 'Nội dung chuyển khoản không khớp định dạng, bỏ qua.' });
    }

    const [, idPrefix, tier] = match;
    const targetTier = tier.toUpperCase();
    const paidAmount = amountIn !== undefined ? Number(amountIn) : 0;

    // 4. Validate payment amount for the corresponding tier
    const requiredAmount = targetTier === 'BASIC' ? 79000 : 199000;
    if (paidAmount < requiredAmount) {
      console.warn(`[SePay Webhook] Paid amount ${paidAmount} is less than required ${requiredAmount} for ${targetTier}. Upgrade rejected.`);
      return NextResponse.json({ success: false, message: `Số tiền thanh toán (${paidAmount}đ) không đủ để nâng cấp gói ${targetTier} (yêu cầu ${requiredAmount}đ).` });
    }

    // 5. Look up user by UUID prefix in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profiles, error: lookupError } = await supabase
      .from('profiles')
      .select('id, email')
      .like('id', `${idPrefix.toLowerCase()}%`);

    if (lookupError || !profiles || profiles.length === 0) {
      console.error(`[SePay Webhook] User profile not found for prefix: ${idPrefix}`, lookupError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profiles.length > 1) {
      console.error(`[SePay Webhook] Ambiguous prefix clash: Multiple users found for prefix ${idPrefix}`);
      return NextResponse.json({ error: 'Ambiguous user prefix' }, { status: 400 });
    }

    const userProfile = profiles[0];

    // 6. Perform user tier upgrade
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        tier: targetTier, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userProfile.id);

    if (updateError) {
      console.error('[SePay Webhook] Failed to update user tier:', updateError);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }

    console.log(`[SePay Webhook] SUCCESS: Upgraded user ${userProfile.email} (${userProfile.id}) to ${targetTier} via transaction ${transactionId}`);
    return NextResponse.json({ 
      success: true, 
      message: `Tài khoản ${userProfile.email} đã được nâng cấp lên ${targetTier} thành công.` 
    });

  } catch (err: any) {
    console.error('[SePay Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "hoiyAi SePay Webhook is online. Only POST requests containing transaction payloads will trigger account upgrades." 
  });
}

export const dynamic = 'force-dynamic';
