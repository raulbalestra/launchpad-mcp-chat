import { match as matchLocale } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { i18n } from '@/i18n.config';

function getLocale(request: NextRequest): string {
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  const locales: Readonly<string[]> = i18n.locales;
  // Negotiator returns `['*']` (or junk) for empty/wildcard Accept-Language —
  // common when the page is loaded inside the Strapi preview iframe. Intl
  // rejects those tags, so filter to valid BCP-47 and fall back to the default
  // locale instead of throwing a RangeError (which 500s the whole page).
  const languages = new Negotiator({ headers: negotiatorHeaders })
    .languages()
    .filter((lang) => lang !== '*' && /^[a-zA-Z]{2,3}([-_].+)?$/.test(lang));

  try {
    return matchLocale(languages, locales, i18n.defaultLocale);
  } catch {
    return i18n.defaultLocale;
  }
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = i18n.locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(
        `/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`,
        request.url
      )
    );
  }
}

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
