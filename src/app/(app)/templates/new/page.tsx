import { CreateTemplateClient } from "@/components/templates/CreateTemplateClient";
import { PageContainer } from "@/components/ui/PageContainer";

export default function NewTemplatePage() {
  return (
    <PageContainer>
      <div className="flex min-h-[60vh] items-start justify-center pt-[12vh]">
        <CreateTemplateClient />
      </div>
    </PageContainer>
  );
}
