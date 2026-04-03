import { TagsManagerClient } from "@/components/contacts/TagsManagerClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PeopleTagsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Tags"
        description="Create and manage tags to organize people. Assign tags in contact details or in bulk."
      />
      <TagsManagerClient />
    </PageContainer>
  );
}

