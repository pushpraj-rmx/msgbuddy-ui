import { redirect } from "next/navigation";

export default async function PeopleContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/people/contacts/${id}`);
}

