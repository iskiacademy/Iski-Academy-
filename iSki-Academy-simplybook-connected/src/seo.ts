export const SITE_ORIGIN = 'https://iski.academy'

export type PageMetadata = {
  title: string
  description: string
  keywords: string
  image: string
}

export const PAGE_METADATA: Record<string, PageMetadata> = {
  '/': {
    title: 'Ski School Kopaonik | iSki Academy',
    description: 'English-speaking ski lessons in Kopaonik for families, kids, adults and advanced skiers. Build confidence and check availability with iSki Academy.',
    keywords: 'ski school Kopaonik, English ski instructor Kopaonik, private ski lessons, kids ski lessons, family ski lessons',
    image: '/assets/igor-downhill.webp',
  },
  '/families': {
    title: 'Family Ski Lessons in Kopaonik | iSki Academy',
    description: 'Private family ski lessons in Kopaonik with English-speaking instructors. Build confidence together with coaching paced around your family.',
    keywords: 'family ski lessons Kopaonik, family ski school Serbia, English ski instructor Kopaonik, private family ski lesson, Kopaonik ski holiday',
    image: '/assets/banner-families.webp',
  },
  '/kids': {
    title: 'Kids Ski Lessons in Kopaonik | iSki Academy',
    description: 'Safe, encouraging kids’ ski lessons in Kopaonik. English-speaking instructors help young skiers build confidence one small win at a time.',
    keywords: 'kids ski lessons Kopaonik, children ski school Serbia, English ski instructor Kopaonik, beginner kids ski lessons, Kopaonik family ski',
    image: '/assets/banner-kids.webp',
  },
  '/adults': {
    title: 'Adult Ski Lessons in Kopaonik | iSki Academy',
    description: 'Learn or improve at your own pace with private adult ski lessons in Kopaonik. Clear, English-first coaching for confident turns.',
    keywords: 'adult ski lessons Kopaonik, private ski lessons Kopaonik, English speaking ski instructor, beginner ski lessons Serbia, adult ski school',
    image: '/assets/banner-adults.webp',
  },
  '/performance': {
    title: 'Performance Ski Coaching in Kopaonik | iSki',
    description: 'Private performance ski coaching in Kopaonik for intermediate and advanced skiers. Improve carving, control, rhythm and line choice.',
    keywords: 'performance ski coaching Kopaonik, advanced ski instructor Serbia, carving lessons Kopaonik, race coach ski Serbia, private ski coaching',
    image: '/assets/banner-performance.webp',
  },
  '/book': {
    title: 'Check Ski Lesson Availability | iSki Academy',
    description: 'Check live instructor availability by lesson length in Kopaonik. Choose a Serbia-time start, send a request and continue with iSki on WhatsApp.',
    keywords: 'book ski lesson Kopaonik, check ski lesson availability, ski lesson enquiry Serbia, private ski booking Kopaonik, iSki Academy booking',
    image: '/assets/igor-downhill.webp',
  },
  '/partners': {
    title: 'Kopaonik Ski School Partners | iSki Academy',
    description: 'Partner with iSki Academy in Kopaonik. We welcome local hotels, chalets and mountain-service businesses serving international ski guests.',
    keywords: 'Kopaonik ski school partners, Kopaonik hotel ski lessons, ski tourism partners Serbia, ski school referrals, Kopaonik winter services',
    image: '/assets/banner-families.webp',
  },
  '/contact': {
    title: 'Contact iSki Academy | Kopaonik Ski Lessons',
    description: 'Contact iSki Academy about English-speaking ski lessons in Kopaonik. Check availability by WhatsApp or email the coaching team.',
    keywords: 'contact iSki Academy, ski school Kopaonik contact, WhatsApp ski instructor Kopaonik, English ski lessons Serbia, Kopaonik ski coaching',
    image: '/assets/igor-downhill.webp',
  },
  '/about/igor-andric': {
    title: 'About Igor Andrić | Ski Coach in Kopaonik',
    description: 'Meet Igor Andrić, ISIA Level 3 Ski Instructor and Race Coach with 17 seasons at Kopaonik and an English-first coaching approach.',
    keywords: 'Igor Andrić ski instructor, ISIA ski instructor Kopaonik, race coach Serbia, English ski instructor Kopaonik, iSki Academy founder',
    image: '/assets/igor-portrait.webp',
  },
  '/gallery': {
    title: 'Skiing in Kopaonik | iSki Academy Gallery',
    description: 'See authentic iSki Academy photos from Kopaonik: ski coaching, mountain terrain and Igor Andrić in motion on the snow.',
    keywords: 'Kopaonik skiing photos, iSki Academy gallery, ski coach Kopaonik, Serbia ski resort, Igor Andrić skiing',
    image: '/assets/gallery-igor-1.webp',
  },
  '/plan-your-visit': {
    title: 'Plan a Ski Trip to Kopaonik | iSki Academy',
    description: 'Plan your Kopaonik ski visit with practical starting points for travel, accommodation, transfers, equipment and clothing.',
    keywords: 'plan Kopaonik ski trip, Kopaonik travel advice, Kopaonik ski accommodation, Kopaonik ski transfer, what to wear skiing Serbia',
    image: '/assets/banner-families.webp',
  },
  '/prices': {
    title: 'Ski Lesson Prices in Kopaonik | iSki Academy',
    description: 'Explore iSki Academy starting prices for family, kids, adult and performance ski lessons in Kopaonik. Ask the team about your dates.',
    keywords: 'ski lesson prices Kopaonik, family ski lesson price Serbia, kids ski school prices, private ski lesson cost Kopaonik, ski coaching rates',
    image: '/assets/banner-performance.webp',
  },
  '/faq': {
    title: 'Ski Lesson FAQs | iSki Academy Kopaonik',
    description: 'Get answers about English-speaking instructors, lesson levels, ski equipment, children’s lessons and booking ski coaching in Kopaonik.',
    keywords: 'Kopaonik ski lesson FAQ, ski school questions Serbia, kids ski lesson information, English ski instructor, how to book ski lessons',
    image: '/assets/banner-kids.webp',
  },
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'SkiSchool'],
  name: 'iSki Academy',
  url: SITE_ORIGIN,
  image: `${SITE_ORIGIN}/assets/igor-downhill.webp`,
  telephone: '+381631016260',
  email: 'Iski.academy88@gmail.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Kopaonik',
    addressCountry: 'RS',
  },
  areaServed: { '@type': 'Place', name: 'Kopaonik, Serbia' },
  sameAs: [
    'https://www.instagram.com/iski.academy/',
    'https://www.facebook.com/profile.php?id=61595541632796',
    'https://www.tiktok.com/@iski.academy',
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Do instructors speak English?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. English-first instruction is central to iSki Academy. Igor speaks English at C1 level.' },
    },
    {
      '@type': 'Question',
      name: 'How do I book?',
      acceptedAnswer: { '@type': 'Answer', text: 'Choose a lesson format and a live Serbia-time start in the booking calendar, or message iSki on WhatsApp. Your request is saved first; the team follows up to confirm.' },
    },
    {
      '@type': 'Question',
      name: 'Do I need my own equipment?',
      acceptedAnswer: { '@type': 'Answer', text: 'No. Rental equipment is available in Kopaonik and iSki can advise on fitting.' },
    },
  ],
}

export function normalizePath(path: string) {
  const cleanPath = path.split('?')[0].split('#')[0] || '/'
  return cleanPath === '/' ? '/' : cleanPath.replace(/\/+$/, '')
}

export function getPageMetadata(path: string) {
  const normalized = normalizePath(path)
  if (normalized === '/admin' || normalized.startsWith('/admin/')) return {
    title: 'iSki Staff Desk | Private Operations',
    description: 'Private staff access for iSki Academy booking operations.',
    keywords: 'iSki Academy staff',
    image: '/assets/ski-academy-logo.png',
    path: normalized,
    noindex: true,
  }
  const page = PAGE_METADATA[normalized]
  if (page) return { ...page, path: normalized, noindex: false }
  return {
    title: 'Page not found | iSki Academy',
    description: 'This iSki Academy page could not be found.',
    keywords: 'iSki Academy, Kopaonik ski lessons, ski school',
    image: '/assets/igor-downhill.webp',
    path: normalized,
    noindex: true,
  }
}

export function getStructuredData(path: string) {
  const normalized = normalizePath(path)
  if (normalized === '/admin' || normalized.startsWith('/admin/')) return []
  return normalized === '/faq' ? [localBusinessSchema, faqSchema] : [localBusinessSchema]
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderHeadTags(path: string) {
  const page = getPageMetadata(path)
  const canonical = page.noindex ? undefined : `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`
  const image = `${SITE_ORIGIN}${page.image}`
  const structuredData = JSON.stringify(getStructuredData(path)).replace(/</g, '\\u003c')
  return [
    `<title>${escapeAttribute(page.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(page.description)}">`,
    `<meta name="keywords" content="${escapeAttribute(page.keywords)}">`,
    `<meta name="robots" content="${page.noindex ? 'noindex,nofollow' : 'index,follow'}">`,
    ...(canonical ? [`<link rel="canonical" href="${escapeAttribute(canonical)}">`] : []),
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeAttribute(page.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(page.description)}">`,
    ...(canonical ? [`<meta property="og:url" content="${escapeAttribute(canonical)}">`] : []),
    '<meta property="og:site_name" content="iSki Academy">',
    `<meta property="og:image" content="${escapeAttribute(image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttribute(page.title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(page.description)}">`,
    `<meta name="twitter:image" content="${escapeAttribute(image)}">`,
    `<script id="iski-jsonld" type="application/ld+json">${structuredData}</script>`,
  ].join('\n    ')
}

export function applyPageMetadata(path: string) {
  if (typeof document === 'undefined') return
  const page = getPageMetadata(path)
  const canonical = page.noindex ? undefined : `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`
  document.title = page.title

  const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, key)
      document.head.appendChild(element)
    }
    element.content = content
  }

  setMeta('meta[name="description"]', 'name', 'description', page.description)
  setMeta('meta[name="keywords"]', 'name', 'keywords', page.keywords)
  setMeta('meta[name="robots"]', 'name', 'robots', page.noindex ? 'noindex,nofollow' : 'index,follow')
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
  setMeta('meta[property="og:title"]', 'property', 'og:title', page.title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', page.description)
  if (canonical) setMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
  else document.head.querySelector('meta[property="og:url"]')?.remove()
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'iSki Academy')
  setMeta('meta[property="og:image"]', 'property', 'og:image', `${SITE_ORIGIN}${page.image}`)
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', page.title)
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', page.description)
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', `${SITE_ORIGIN}${page.image}`)

  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical) {
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.href = canonical
  } else {
    canonicalLink?.remove()
  }

  let schema = document.getElementById('iski-jsonld') as HTMLScriptElement | null
  if (!schema) {
    schema = document.createElement('script')
    schema.id = 'iski-jsonld'
    schema.type = 'application/ld+json'
    document.head.appendChild(schema)
  }
  schema.textContent = JSON.stringify(getStructuredData(path))
}
