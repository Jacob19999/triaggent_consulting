/** Temporary prototype mode, explicitly enabled per deployment. */
export function emailOnlyEnabled() {
  return process.env.FOODBRIDGE_EMAIL_ONLY_LOGIN === "true";
}
