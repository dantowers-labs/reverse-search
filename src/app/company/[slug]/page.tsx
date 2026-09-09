import { redirect } from "next/navigation";

export default async function CompanyRootPage({ params }: PageProps<"/company/[slug]">) {
  const { slug } = await params;
  redirect(`/company/${slug}/profiles`);
}
