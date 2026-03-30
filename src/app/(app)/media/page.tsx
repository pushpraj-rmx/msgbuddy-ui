import { MediaClient, type MediaItem } from "@/components/media/MediaClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export default async function MediaPage() {
  const media = await serverFetch<MediaItem[]>(`${endpoints.media.list}?limit=50`);

  return (
    <PageContainer>
      <PageHeader
        title="Media"
        description="Upload and manage media files for templates and campaigns."
      />
      <MediaClient initialMedia={media} />
    </PageContainer>
  );
}
