import { redirect } from "next/navigation";
import AuthScreen from "@/components/AuthScreen";
import { currentUser } from "@/lib/server/auth";
import { repositoryMode } from "@/lib/server/backend";
export const dynamic = "force-dynamic";
export default async function Login() {
  if (await currentUser()) redirect("/");
  return <AuthScreen local={repositoryMode() === "memory"} />;
}
