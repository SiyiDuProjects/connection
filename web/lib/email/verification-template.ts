// Email clients need inline styles and table layout; interactive UI stays in HeroUI.
export function verificationEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code format.');
  return {
    subject: 'Your Reachard verification code',
    text: `Verify your email\n\nYour Reachard verification code is: ${code}\n\nEnter this code on the email verification page in Reachard. It expires in 10 minutes and can only be used once.\n\nNever share this code. If you did not request it, you can ignore this email.\n\nReachard\nOpportunity starts with a conversation.\nNeed help? support@reachard.co`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verify your email</title></head>
<body style="margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Reachard code expires in 10 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="480" cellspacing="0" cellpadding="0" style="width:100%;max-width:480px"><tr><td style="padding:32px 24px;background:#ffffff;border-radius:20px">
<p style="margin:0 0 32px;font-size:22px;font-weight:700;letter-spacing:-1px">Reachard<span style="color:#007aff">.</span></p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;letter-spacing:-0.6px">Verify your email</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#6e6e73">One last step to your next conversation. Enter this code on the email verification page in Reachard.</p>
<div style="padding:22px 12px;background:#f5f5f7;border-radius:12px;text-align:center;font-family:monospace;font-size:36px;line-height:1.3;font-weight:700;letter-spacing:8px">${code}</div>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#6e6e73">This code expires in <strong style="color:#1d1d1f">10 minutes</strong> and can only be used once.</p>
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6e6e73">Never share this code. If you did not request it, you can ignore this email.</p>
</td></tr><tr><td align="center" style="padding:24px 12px;font-size:12px;line-height:1.8;color:#6e6e73">Opportunity starts with a conversation.<br>Need help? <a href="mailto:support@reachard.co" style="color:#007aff;text-decoration:none">Contact Reachard</a></td></tr></table>
</td></tr></table></body></html>`,
  };
}
