import LoginForm from "./LoginForm";
import { emailOnlyEnabled } from "@/lib/supabase/emailOnly";

export const dynamic = "force-dynamic";

export default function Login() {
  return <LoginForm emailOnly={emailOnlyEnabled()} />;
}
