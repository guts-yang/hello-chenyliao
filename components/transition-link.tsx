'use client';

import * as React from 'react';
import NextLink, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Drop-in replacement for `next/link` that wraps the navigation in a native
 * View Transition when supported. Browsers without the API fall back to a
 * normal route push.
 *
 * Pair with `view-transition-name` CSS on a shared element (e.g. the project
 * card title) to get an animated handoff between list and detail pages.
 */
type Props = React.ComponentPropsWithoutRef<'a'> & LinkProps;

export function TransitionLink({ href, onClick, children, ...rest }: Props) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
      return; // let next/link do its thing
    }
    e.preventDefault();
    document.startViewTransition(() => {
      router.push(typeof href === 'string' ? href : String(href));
    });
  }

  return (
    <NextLink href={href} onClick={handleClick} {...rest}>
      {children}
    </NextLink>
  );
}
