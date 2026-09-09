import { BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

function emailHtml(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="480" cellspacing="0" cellpadding="0" style="width:100%;max-width:480px"><tr><td style="padding:32px 24px;background:#fff;border-radius:20px"><p style="margin:0 0 32px;font-size:22px;font-weight:700"><img src="https://reachard.co${BRAND_MARK_PATH}" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;margin-right:9px;border:0" />${escapeHtml(BRAND_NAME)}</p><h1 style="margin:0 0 16px;font-size:26px">${title}</h1>${content}</td></tr><tr><td align="center" style="padding:24px 12px;font-size:12px;color:#6e6e73">Need help? <a href="mailto:support@reachard.co" style="color:#007aff">Contact ${escapeHtml(BRAND_NAME)}</a></td></tr></table></td></tr></table></body></html>`;
}

export function passwordResetEmail(resetUrl: string) {
  const url = new URL(resetUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/reset-password') throw new Error('Invalid reset URL.');
  return {
    subject: `Reset your ${BRAND_NAME} password`,
    text: `Reset your password\n\nUse this link to choose a new ${BRAND_NAME} password:\n${url.href}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, ignore this email; your password has not changed.\n\nNeed help? support@reachard.co`,
    html: emailHtml('Reset your password', `<p style="font-size:16px;line-height:1.6;color:#6e6e73">Choose a new password to get back to your account.</p><p style="margin:28px 0"><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#007aff;color:#fff;text-decoration:none;font-weight:600">Reset password</a></p><p style="font-size:14px;line-height:1.6;color:#6e6e73">This link expires in 30 minutes and can only be used once.</p><p style="font-size:13px;line-height:1.6;color:#6e6e73">If you did not request this, ignore this email. Your password has not changed.</p>`),
  };
}

export function passwordChangedEmail() {
  return {
    subject: `Your ${BRAND_NAME} password was changed`,
    text: `Your ${BRAND_NAME} password was changed.\n\nAll previous browser and extension sessions have been signed out. Sign in again with your new password.\n\nIf this was not you, use Forgot password at https://reachard.co/sign-in and contact support@reachard.co.`,
    html: emailHtml('Your password was changed', '<p style="font-size:16px;line-height:1.6;color:#6e6e73">All previous browser and extension sessions have been signed out. Sign in again with your new password.</p><p style="font-size:14px;line-height:1.6;color:#6e6e73">If this was not you, use <a href="https://reachard.co/forgot-password" style="color:#007aff">Forgot password</a> and contact support@reachard.co.</p>'),
  };
}
