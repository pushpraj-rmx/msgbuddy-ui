import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

export default async function Home() {
  const raw = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;

  if (token) {
    redirect("/dashboard");
  }

  redirect("/login");
}
