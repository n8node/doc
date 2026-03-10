import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { sanitizeHtml } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await prisma.docPage.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { title: true },
  });
  if (!page) return { title: "Документация" };
  return {
    title: `${page.title} — Документация`,
    description: page.title,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const page = await prisma.docPage.findUnique({
    where: { slug: slug.toLowerCase() },
  });

  if (!page) notFound();

  const safeContent = sanitizeHtml(page.content);

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/docs"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← К разделам
        </Link>
      </div>

      <article className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-foreground">{page.title}</h1>

        <div
          className="doc-content mt-6 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_p]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-1 [&_pre]:bg-surface2 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-border [&_th]:p-2 [&_td]:border [&_td]:border-border [&_td]:p-2"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />
      </article>
    </div>
  );
}
