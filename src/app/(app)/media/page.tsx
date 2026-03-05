import { MediaClient, type MediaItem } from "@/components/media/MediaClient";
import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export default async function MediaPage() {
  const media = await serverFetch<MediaItem[]>(`${endpoints.media.list}?limit=50`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Media</h1>
        <p className="text-sm text-base-content/60">
          Upload and manage media files for templates and campaigns.
        </p>
      </div>
      <MediaClient initialMedia={media} />
    </div>
  );
}
