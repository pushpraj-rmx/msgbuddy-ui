import { TagsManagerClient } from "@/components/contacts/TagsManagerClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { serverFetch } from "@/lib/server-fetch";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function PeopleTagsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const canManageTags = roleHasWorkspacePermission(
    String(me.role),
    "contacts.create"
  );

  return (
    <PageContainer>
      <PageHeader
        title="Tags"
        description={
          canManageTags
            ? "Create and manage tags to organize people. Assign tags in contact details or in bulk."
            : "View tags used to organize people."
        }
      />
      <TagsManagerClient canManageTags={canManageTags} />
    </PageContainer>
  );
}

