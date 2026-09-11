import { ProcessosSetorPage } from "../../../components/processos/ProcessosSetorPage";

type RotinaSetorPageProps = {
  params: Promise<{ setor: string }>;
};

export default async function RotinaSetorPage({ params }: RotinaSetorPageProps) {
  const { setor } = await params;
  return <ProcessosSetorPage setor={setor} />;
}
