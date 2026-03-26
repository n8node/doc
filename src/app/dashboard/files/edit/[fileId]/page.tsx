import { OnlyofficeEditorClient } from "./onlyoffice-editor-client";

type Props = { params: Promise<{ fileId: string }> };

export default async function OnlyofficeEditPage({ params }: Props) {
  const { fileId } = await params;
  return <OnlyofficeEditorClient fileId={fileId} />;
}
