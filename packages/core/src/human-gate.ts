export const HUMAN_GATE_CONTINUE_PROMPT =
  "You asked the user in chat. Call ask_user, request_secret, or request_takeover now.";

const SECRET_ASK =
  /api[ _-]?key|access token|secret key|paste (?:your |the )?(?:key|token|secret|password)|enter (?:your |the )?(?:api|password|token|secret|otp|2fa|code)/i;
const LOGIN_ASK = /sign in|log in|login at|sign into|authenticate at|complete (?:2fa|captcha|duo)/i;
const NEED_USER = /please|need you|can you|could you/i;
const FACT_QUESTION =
  /^(?:which |what |whose |please (?:send|provide|enter|tell)|i need (?:you to|your))/i;

export function textLooksLikeHumanGate(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (SECRET_ASK.test(value)) return true;
  if (LOGIN_ASK.test(value) && (/\bhttps?:\/\//i.test(value) || NEED_USER.test(value))) return true;
  if (/\?\s*$/.test(value) && FACT_QUESTION.test(value)) return true;
  return false;
}

export function shouldContinueForHumanGate(input: {
  scripted?: boolean;
  alreadyContinued?: boolean;
  assembled: string;
}): boolean {
  if (input.scripted || input.alreadyContinued) return false;
  return textLooksLikeHumanGate(input.assembled);
}
