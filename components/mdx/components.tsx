import * as React from 'react';
import NextImage, { type ImageProps } from 'next/image';
import { reactChildrenToString, slugify } from '@/lib/mdx';
import { Callout } from './callout';
import { CodeBlock } from './code-block';

// Match the `MDXComponents` shape exposed by next-mdx-remote/mdx-js without
// taking a hard dependency on `mdx/types` (which is technically a transitive
// dep and prone to resolution issues across versions).
export type MdxComponentsMap = Record<string, React.ElementType>;

/**
 * MDX components map used by both posts and any future MDX-driven detail
 * pages. Each heading auto-generates an `id` matching the TOC entries so the
 * sticky sidebar can scroll-spy onto them.
 */

function makeHeading(level: 2 | 3) {
  const Tag = (`h${level}` as const);
  return function Heading(props: React.HTMLAttributes<HTMLHeadingElement>) {
    const id = props.id ?? slugify(reactChildrenToString(props.children));
    return React.createElement(
      Tag,
      {
        ...props,
        id,
        className:
          level === 2
            ? 'mt-12 scroll-mt-28 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl'
            : 'mt-8 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-foreground/95',
      },
      <>
        <a
          href={`#${id}`}
          aria-label="Anchor"
          className="mr-2 text-muted-foreground/40 no-underline opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          #
        </a>
        {props.children}
      </>,
    );
  };
}

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  className?: string;
  'data-language'?: string;
  'data-filename'?: string;
};

function Code({ className, children, ...rest }: CodeProps) {
  // Inline code path (no language class injected by remark).
  return (
    <code
      {...rest}
      className={`rounded-md border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.92em] ${className ?? ''}`}
    >
      {children}
    </code>
  );
}

function Pre({ children }: { children?: React.ReactNode }) {
  // Unwrap <pre><code class="language-xxx">...</code></pre> into <CodeBlock />.
  if (React.isValidElement(children) && children.type === 'code') {
    const codeProps = (children.props ?? {}) as CodeProps;
    const className = codeProps.className ?? '';
    const langMatch = /language-([\w-]+)/.exec(className);
    const filename =
      typeof codeProps['data-filename'] === 'string' ? codeProps['data-filename'] : undefined;
    const inner =
      typeof codeProps.children === 'string'
        ? codeProps.children
        : reactChildrenToString(codeProps.children);
    return <CodeBlock language={langMatch?.[1]} filename={filename}>{inner}</CodeBlock>;
  }
  // Fallback: render a plain <pre> if MDX gave us something unexpected.
  return <pre className="not-prose overflow-x-auto rounded-2xl bg-muted/40 p-4 text-sm">{children}</pre>;
}

function Anchor({
  href = '',
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...rest}
      target={isExternal ? '_blank' : rest.target}
      rel={isExternal ? 'noopener noreferrer' : rest.rel}
      className="font-medium text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/0.4)] decoration-1 underline-offset-4 transition-colors hover:decoration-[hsl(var(--primary))]"
    >
      {children}
    </a>
  );
}

function Img(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { src, alt, width, height, ...rest } = props;
  if (!src) return null;
  const resolvedWidth = typeof width === 'string' ? Number(width) : width ?? 1280;
  const resolvedHeight = typeof height === 'string' ? Number(height) : height ?? 720;
  return (
    <figure className="not-prose my-8">
      <NextImage
        src={String(src)}
        alt={alt ?? ''}
        width={Number(resolvedWidth) || 1280}
        height={Number(resolvedHeight) || 720}
        className="rounded-2xl border border-white/40 dark:border-white/10"
        {...(rest as Omit<ImageProps, 'src' | 'alt' | 'width' | 'height'>)}
      />
      {alt && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">{alt}</figcaption>
      )}
    </figure>
  );
}

export const mdxComponents: MdxComponentsMap = {
  h2: makeHeading(2),
  h3: makeHeading(3),
  p: (props) => <p {...props} className="my-4 leading-7 text-foreground/90" />,
  ul: (props) => <ul {...props} className="my-4 list-disc space-y-1 pl-6 marker:text-muted-foreground" />,
  ol: (props) => <ol {...props} className="my-4 list-decimal space-y-1 pl-6 marker:text-muted-foreground" />,
  blockquote: (props) => (
    <blockquote
      {...props}
      className="my-6 border-l-2 border-[hsl(var(--primary)/0.5)] bg-white/30 dark:bg-white/[0.03] pl-4 italic text-foreground/80"
    />
  ),
  hr: () => <hr className="my-10 border-t border-dashed border-border" />,
  a: Anchor,
  code: Code,
  pre: Pre,
  img: Img,
  Callout,
};
