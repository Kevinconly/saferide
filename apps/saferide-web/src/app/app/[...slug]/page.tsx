import { redirect } from "next/navigation";

interface Props {
  params: { slug?: string[] };
}

export default function SlugPage({ params }: Props) {
  const slug = params.slug ?? [];
  const path = "/" + slug.join("/");
  // If no slug segments, redirect to root
  redirect(path || "/");
}
