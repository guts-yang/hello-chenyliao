import { MDXRemote } from 'next-mdx-remote/rsc';
import { mdxComponents } from './components';

/**
 * Server-rendered MDX with our default components map. Use inside an
 * <article> wrapper that already supplies prose styling.
 *
 * `source` is the raw MDX/Markdown string (either from the database body
 * column or a static `.md` file).
 */
export function MdxContent({ source }: { source: string }) {
  if (!source || !source.trim()) return null;
  return (
    <div className="prose-content">
      <MDXRemote
        source={source}
        components={mdxComponents}
        options={{
          mdxOptions: {
            // Keep the parser permissive: posts may include arbitrary HTML.
            remarkPlugins: [],
            rehypePlugins: [],
          },
          parseFrontmatter: false,
        }}
      />
    </div>
  );
}
