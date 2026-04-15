import { MediaClient, type MediaItem } from "@/components/media/MediaClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function MediaPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const media = await serverFetch<MediaItem[]>(`${endpoints.media.list}?limit=50`);

  return (
    <PageContainer>
      <PageHeader
        title="Media"
        description="Upload and manage media files for templates and campaigns."
      />
      <MediaClient initialMedia={media} meRole={String(me.role)} />
    </PageContainer>
  );
}
