import { redirect } from "next/navigation";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const segment = typeof sp.segment === "string" ? sp.segment : undefined;
  redirect(segment ? `/people/contacts?segment=${segment}` : "/people/contacts");
}
