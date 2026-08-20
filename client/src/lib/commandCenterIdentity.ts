export type CommandCenterPersona = "abdulrahman" | "wael" | "sheikh_issa";

type AuthIdentity = {
  name?: string | null;
  email?: string | null;
  openId?: string | null;
} | null | undefined;

export function resolveCommandCenterPersona(user: AuthIdentity): CommandCenterPersona | null {
  const identity = [user?.name, user?.email, user?.openId]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  if (/وائل|wael/.test(identity)) return "wael";
  if (/الشيخ\s*عيسى|شيخ\s*عيسى|sheikh[^a-z]*issa|sheikhissa/.test(identity)) return "sheikh_issa";
  if (/عبد\s*الرحمن|عبدالرحمن|abdalrahman|abdulrahman|zaqout/.test(identity)) return "abdulrahman";
  return null;
}

export function getCommandCenterTokenKey(persona: CommandCenterPersona | null): string {
  return persona ? `cc_token_${persona}` : "cc_token_shared";
}

export function getPersonaLoginHint(persona: CommandCenterPersona | null): string | null {
  if (persona === "wael") return "أهلاً وائل، أدخل رمزك الشخصي للمتابعة.";
  if (persona === "sheikh_issa") return "يا مرحبا شيخ عيسى، أدخل رمزك الشخصي للمتابعة.";
  if (persona === "abdulrahman") return "أهلاً عبدالرحمن، أدخل رمزك الشخصي للمتابعة.";
  return null;
}
