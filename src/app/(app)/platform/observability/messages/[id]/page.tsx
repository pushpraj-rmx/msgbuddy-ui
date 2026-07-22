import { MessageTimelineClient } from "@/components/observability/MessageTimelineClient";

export default async function MessageTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MessageTimelineClient messageId={id} />;
}
