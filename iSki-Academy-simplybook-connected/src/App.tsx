import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  AtSign,
  MapPin,
  Menu,
  MessageCircle,
  Mountain,
  Phone,
  Play,
  ShieldCheck,
  Snowflake,
  Star,
  Trophy,
  X,
} from 'lucide-react'
import AdminApp from './admin/AdminApp'
import SiteAudioControls from './SiteAudioControls'
import { trackConversion } from './analytics'
import { applyPageMetadata, normalizePath } from './seo'

const HERO_IMAGE = '/assets/igor-downhill.webp'
const WHATSAPP = '381631016260'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`
const EMAIL = 'Iski.academy88@gmail.com'
const SIMPLYBOOK_URL = (import.meta.env.VITE_SIMPLYBOOK_URL || import.meta.env.VITE_EXTERNAL_BOOKING_URL || 'https://iskiacademy.simplybook.asia/v2/').trim()

const colors = {
  navy: '#0A1432',
  navy2: '#142B73',
  blue: '#1284E7',
  yellow: '#FAD903',
}

type Program = {
  slug: string
  banner: string
  eyebrow: string
  title: string
  description: string
  audience: string
  price: string
  accent: string
  bullets: string[]
  method: string[]
  faq: { q: string; a: string }[]
}

const programs: Program[] = [
  {
    slug: 'families',
    banner: '/assets/banner-families.webp',
    eyebrow: 'For parents & children',
    title: 'Family ski lessons made around your family.',
    description: 'Private English-speaking coaching for parents and children, built around safety, confidence and real progress.',
    audience: 'Families with children aged 4–12',
    price: 'From €390',
    accent: 'blue',
    bullets: ['Suitable terrain and pace for everyone', 'Games and small wins for children', 'Progress for parents without splitting the holiday', 'Flexible private family format'],
    method: ['Fun', 'Confidence', 'Control', 'Progress'],
    faq: [
      { q: 'Do we all ski together?', a: 'Usually yes, but the instructor adapts the session so children and parents can work on different goals.' },
      { q: 'What age can children start?', a: 'From around 4 years old, depending on the child’s comfort, readiness and attention span.' },
      { q: 'Do we need a ski pass and equipment?', a: 'Yes, these are separate. iSki can guide you on suitable equipment and where to arrange it.' },
      { q: 'How many people can join a family lesson?', a: 'Tell us your group size and the team will recommend a suitable private format for your family.' },
      { q: 'Can we include first-timers and confident skiers?', a: 'Yes. Share each skier’s level so the coach can adapt terrain, pace and goals to your group.' },
    ],
  },
  {
    slug: 'kids',
    banner: '/assets/banner-kids.webp',
    eyebrow: 'For young skiers',
    title: 'Confidence before speed.',
    description: 'Small-group and private ski programmes where children learn to enjoy the mountain, then master it.',
    audience: 'Children aged 4–12',
    price: 'From €60',
    accent: 'yellow',
    bullets: ['Small groups of maximum 3–4 children', 'Play-based balance, stopping and turning', 'Parent updates after each session', 'Safety-first terrain and pacing'],
    method: ['Snow Explorer', 'Snow Starter', 'Green Rider', 'Confident Cruiser', 'Mountain Explorer'],
    faq: [
      { q: 'My child has never skied. Is that okay?', a: 'Yes. Most children start at Snow Explorer level with a private or small-group introduction.' },
      { q: 'What if my child gets tired?', a: 'The instructor adjusts pace and terrain. A positive experience matters more than pushing distance.' },
      { q: 'Will my child be safe?', a: 'Safety comes first with suitable terrain, helmet guidance, controlled group size and age-appropriate pacing.' },
      { q: 'What should my child bring?', a: 'Bring warm, waterproof layers, gloves and a helmet. iSki can advise on suitable rental equipment in Kopaonik.' },
      { q: 'Can siblings learn together?', a: 'They can be considered together; placement depends on their ages, confidence and ski levels, so include those details in your enquiry.' },
    ],
  },
  {
    slug: 'adults',
    banner: '/assets/banner-adults.webp',
    eyebrow: 'For beginners & improvers',
    title: 'Learn to ski with confidence, not pressure.',
    description: 'Private and semi-private lessons for adults who want to understand the movement and enjoy every turn.',
    audience: 'Adult beginners, returners, couples & friends',
    price: 'From €60',
    accent: 'blue',
    bullets: ['Clear teaching without confusing jargon', 'Your own pace, with no pressure to keep up', 'Practical feedback after every movement', 'A clear plan from first stop to confident turns'],
    method: ['Understand', 'Practise', 'Control', 'Enjoy'],
    faq: [
      { q: 'Can I start as a complete beginner?', a: 'Absolutely. Many iSki guests start from their very first day on skis.' },
      { q: 'Can two friends share a lesson?', a: 'Yes. Semi-private lessons work well for couples or friends with a similar level.' },
      { q: 'Can you help if I am afraid of speed?', a: 'Yes. Speed control is one of the first skills we develop.' },
      { q: 'What if I feel nervous on the slopes?', a: 'Your pace and suitable terrain come first; share what feels uncomfortable so the coach can shape the session around it.' },
      { q: 'Can my partner join my lesson?', a: 'Couples and friends can ask about a semi-private lesson; a similar level usually makes it easier to share one session.' },
    ],
  },
  {
    slug: 'performance',
    banner: '/assets/banner-performance.webp',
    eyebrow: 'With Igor Andrić',
    title: 'Master the movement.',
    description: 'Advanced coaching for intermediate and experienced skiers who want better control, precision and confidence at speed.',
    audience: 'Intermediate & advanced skiers',
    price: 'From €130',
    accent: 'yellow',
    bullets: ['Carving, rhythm and edge control', 'Speed control and line choice', 'Moguls, steep terrain and variable snow', 'Video analysis and race-inspired skills'],
    method: ['Understand', 'Practise', 'Control', 'Progress'],
    faq: [
      { q: 'Am I good enough for performance coaching?', a: 'If you can ski blue slopes and want to improve control or technique, you are ready.' },
      { q: 'Do I need to send a video first?', a: 'It helps, but it is not required. You can describe your goals in the enquiry.' },
      { q: 'Will Igor teach every session?', a: 'Igor teaches performance sessions personally, subject to availability.' },
      { q: 'Can a session focus on carving and edge control?', a: 'Yes. Carving, rhythm and edge control are among the available coaching focuses.' },
      { q: 'Can we include video analysis?', a: 'Video analysis can be part of performance coaching when useful; mention your goal in the enquiry.' },
    ],
  },
]

const navItems = [
  { label: 'Ski lessons', href: '/families' },
  { label: 'About Igor', href: '/about/igor-andric' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Stories', href: '/stories' },
  { label: 'Plan your visit', href: '/plan-your-visit' },
  { label: 'Prices', href: '/prices' },
  { label: 'Partners', href: '/partners' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
]

const galleryImages = [
  { src: '/assets/igor-action.webp', alt: 'Igor carving on the piste', label: 'Dynamic downhill', category: 'Coaching' },
  { src: '/assets/gallery-igor-1.webp', alt: 'Ski coaching in the mountain light', label: 'On the snow', category: 'Coaching' },
  { src: '/assets/gallery-igor-2.webp', alt: 'Ski turn across a wide mountain slope', label: 'Mountain movement', category: 'Coaching' },
  { src: '/assets/gallery-igor-3.webp', alt: 'Evening ski run in the mountains', label: 'Golden hour', category: 'Atmosphere' },
  { src: '/assets/gallery-igor-4.webp', alt: 'Sunrise over a snowy mountain', label: 'The Kopaonik feeling', category: 'Mountain' },
  { src: '/assets/igor-forest-action.webp', alt: 'Skiing through the forest edge', label: 'Find your line', category: 'Mountain' },
]

const SOURCE_BY_ROUTE: Record<string, string> = {
  '/families': 'Families',
  '/kids': 'Kids',
  '/adults': 'Adults',
  '/performance': 'Performance',
  '/partners': 'Partner',
}

function go(path: string) {
  const target = new URL(path, window.location.origin)
  if (target.pathname === '/book' && !target.searchParams.has('source')) {
    target.searchParams.set('source', SOURCE_BY_ROUTE[window.location.pathname] || 'Google')
  }
  window.history.pushState({}, '', `${target.pathname}${target.search}${target.hash}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function waLink(message = 'Hi iSki Academy, I would like to check availability for ski lessons in Kopaonik.') {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`
}

function BrandMark({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? 'brand--light' : ''}`} href="/" onClick={(e) => { e.preventDefault(); go('/') }} aria-label="iSki Academy home">
    <img className="brand__logo" src={light ? '/assets/ski-academy-logo-white.png' : '/assets/ski-academy-logo.png'} alt="iSKI Academy" />
  </a>
}

function Button({ href, children, variant = 'primary', onClick, icon = true }: { href?: string; children: ReactNode; variant?: 'primary' | 'outline' | 'yellow' | 'text'; onClick?: () => void; icon?: boolean }) {
  const className = `btn btn--${variant}`
  if (href) {
    const isInternal = href.startsWith('/')
    return <a className={className} href={href} target={isInternal ? undefined : '_blank'} rel={isInternal ? undefined : 'noreferrer'} onClick={(e) => { if (isInternal) { e.preventDefault(); go(href) } }}>{children}{icon && <ArrowRight size={17} />}</a>
  }
  return <button className={className} onClick={onClick}>{children}{icon && <ArrowRight size={17} />}</button>
}

function Header({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  const [lessonsOpen, setLessonsOpen] = useState(false)
  const lightMode = path === '/about/igor-andric'
  useEffect(() => { setOpen(false); setLessonsOpen(false) }, [path])
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setLessonsOpen(false) } }; document.addEventListener('keydown', closeOnEscape); return () => document.removeEventListener('keydown', closeOnEscape) }, [])
  useEffect(() => { document.body.classList.toggle('mobile-menu-open', open); return () => document.body.classList.remove('mobile-menu-open') }, [open])
  return (
    <header className={`site-header ${lightMode ? 'site-header--light' : ''}`}>
      {open && <button type="button" className="mobile-menu-scrim" aria-label="Close navigation menu" onClick={() => { setOpen(false); setLessonsOpen(false) }} />}
      <div className="container header__inner">
        <BrandMark light={!lightMode} />
        <nav id="primary-navigation" className={`main-nav ${open ? 'main-nav--open' : ''}`} aria-label="Main navigation">
          <div className={`nav-dropdown ${lessonsOpen ? 'is-open' : ''}`} onMouseEnter={() => setLessonsOpen(true)} onMouseLeave={() => setLessonsOpen(false)}>
            <button className="nav-dropdown__trigger" onClick={() => setLessonsOpen(!lessonsOpen)}>Ski lessons <ChevronDown size={14} /></button>
            <div className="nav-dropdown__menu">
              {programs.map((program) => <a key={program.slug} href={`/${program.slug}`} onClick={(e) => { e.preventDefault(); go(`/${program.slug}`); setLessonsOpen(false); setOpen(false) }}>{program.slug[0].toUpperCase() + program.slug.slice(1)}<span>{program.price}</span></a>)}
            </div>
          </div>
          {navItems.slice(1).map((item) => <a key={item.href} href={item.href} onClick={(e) => { e.preventDefault(); go(item.href); setOpen(false) }}>{item.label}</a>)}
          <a className="main-nav__whatsapp" href={waLink()} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><MessageCircle size={16} /> WhatsApp</a>
        </nav>
        <div className="header__actions"><a className="header__wa" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a><Button href="/book" variant="yellow">Book now</Button></div>
        <button className="menu-toggle" onClick={() => { setOpen((value) => !value); setLessonsOpen(false) }} aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="primary-navigation">{open ? <X /> : <Menu />}</button>
      </div>
    </header>
  )
}

function SectionLabel({ children, light = false }: { children: ReactNode; light?: boolean }) { return <div className={`section-label ${light ? 'section-label--light' : ''}`}><span />{children}</div> }

function Snowfall() {
  const flakes = Array.from({ length: 128 }, (_, index) => ({
    left: `${(index * 47 + 11) % 100}%`,
    delay: `${(index % 32) * 0.22}s`,
    duration: `${4 + ((index * 7) % 13)}s`,
    size: `${3 + ((index * 3) % 8)}px`,
  }))
  return <div className="snowfall" aria-hidden="true">{flakes.map((flake, index) => <span className={`snowflake snowflake--${index % 6}`} key={index} style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }} />)}</div>
}

function TrustBar() {
  const items = [
    { icon: Trophy, title: 'National champion', text: '8 years in a row' },
    { icon: ShieldCheck, title: 'ISIA Level 3', text: 'Ski instructor' },
    { icon: Mountain, title: '17 seasons', text: 'At Kopaonik' },
    { icon: Star, title: 'Race coach', text: 'Youth & performance' },
    { icon: MessageCircle, title: 'English C1', text: 'English-first lessons' },
  ]
  return <section className="trust-bar"><div className="container trust-bar__grid">{items.map(({ icon: Icon, title, text }) => <div className="trust-item" key={title}><Icon size={27} /><div><strong>{title}</strong><span>{text}</span></div></div>)}</div></section>
}

function Hero() {
  return <section className="hero">
    <Snowfall />
    <div className="hero__image" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
    <div className="hero__wash" />
    <div className="container hero__content">
      <div className="hero__copy">
        <SectionLabel light>English-first ski coaching · Kopaonik</SectionLabel>
        <h1>Master the{' '}<br /><em>mountain.</em></h1>
        <p className="hero__lead">Private, family and performance coaching in Kopaonik. Learn with a champion-led team, build confidence and make every day on snow count.</p>
        <div className="hero__actions"><Button href="/book">Check availability</Button><Button href={waLink()} variant="outline">Chat on WhatsApp</Button></div>
        <div className="hero__micro"><span className="hero__play"><Play size={13} fill="currentColor" /></span> Coaching for every level · Kopaonik, Serbia</div>
      </div>
      <div className="hero__side-note"><span>LEARN</span><b>/</b><span>MOVE</span><b>/</b><span>ENJOY</span></div>
    </div>
    <div className="hero__mountain-line" aria-hidden="true" />
  </section>
}

function ExperienceCards() {
  return <section className="section section--cream"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Find your line</SectionLabel><h2>Choose your<br /><em>experience.</em></h2></div><p>Different skiers need different coaching. Start with the path that feels like you.</p></div><div className="experience-grid">{programs.map((program, index) => <a className={`experience-card experience-card--${program.accent}`} key={program.slug} href={`/${program.slug}`} onClick={(e) => { e.preventDefault(); go(`/${program.slug}`) }}><div className="experience-card__num">0{index + 1}</div><div className="experience-card__body"><span className="eyebrow">{program.eyebrow}</span><h3>{program.title}</h3><p>{program.description}</p><span className="card-link">Explore {program.slug} <ArrowRight size={16} /></span></div><div className="experience-card__mark"><Snowflake size={46} /></div></a>)}</div></div></section>
}

function WhyISki() {
  return <section className="section why"><div className="container why__grid"><div className="why__visual"><div className="why__poster"><span className="poster__top">THE iSKI METHOD</span><strong>FUN</strong><span>↓</span><strong>CONFIDENCE</strong><span>↓</span><strong>CONTROL</strong><span>↓</span><strong>PROGRESS</strong><div className="poster__line" /></div><div className="why__stamp">KOPAONIK<br /><b>RS</b><br />EST. 2009</div></div><div className="why__copy"><SectionLabel>More than a ski lesson</SectionLabel><h2>Coaching that<br /><em>stays with you.</em></h2><p className="lead">The best lesson is not the one where someone tells you what to do. It is the one where you understand the movement, feel the difference and leave ready to repeat it.</p><div className="benefit-list">{['English-first coaching for international guests', 'Founder-led team of five ski instructors', 'Private and small-group lesson options', 'Family-friendly progress updates', 'Fast WhatsApp booking support'].map((item) => <div className="benefit" key={item}><span><Check size={15} /></span>{item}</div>)}</div><Button href="/about/igor-andric" variant="text">Meet Igor & the team</Button></div></div></section>
}

function FounderStrip() {
  return <section className="founder-strip"><div className="container founder-strip__grid"><div><SectionLabel light>The coach behind the method</SectionLabel><h2>One coach.<br /><em>Three perspectives.</em></h2><p>Igor Andrić brings together the athlete, the sport master and the professional ski instructor.</p><Button href="/about/igor-andric" variant="outline">Why Igor?</Button></div><div className="founder-stats"><div><strong>8×</strong><span>National champion</span></div><div><strong>17</strong><span>Seasons at Kopaonik</span></div><div><strong>C1</strong><span>English level</span></div><div><strong>5</strong><span>Ski instructors</span></div></div></div></section>
}

function HomeGallery() {
  return <section className="section home-gallery"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>See the season</SectionLabel><h2>Real snow.<br /><em>Real movement.</em></h2></div><div><p>Get to know your coach, explore the terrain and picture your time on the mountain before you arrive.</p><Button href="/gallery" variant="text">Open the gallery</Button></div></div><div className="home-gallery__grid">{galleryImages.slice(0, 4).map((image, index) => <a className={`home-gallery__tile home-gallery__tile--${index + 1}`} href="/gallery" key={image.src} onClick={(e) => { e.preventDefault(); go('/gallery') }}><img src={image.src} alt={image.alt} /><span>{image.label}</span></a>)}</div></div></section>
}

function Packages() {
  const packages = [
    ['Family Snow Start', 'First-time families', '3 × 90 min', '€390–440', 'A calm, private start for the whole family.'],
    ['Kids Confidence Camp', 'Children aged 4–12', '5 × 2 hours', '€290–330', 'Playful, structured progress in a small group.'],
    ['Private Ski Lesson', 'Adults & improvers', '60 minutes', '€60–70', 'Clear feedback for your next confident turn.'],
    ['Performance Session', 'Intermediate & advanced', '90 minutes', '€130–150', 'Precision coaching with Igor.'],
  ]
  return <section className="section section--cream packages"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Start with a plan</SectionLabel><h2>Popular<br /><em>packages.</em></h2></div><p>Tell us your dates and goals. We will recommend the right instructor, format and pace.</p></div><div className="packages-grid">{packages.map(([name, who, duration, price, copy], index) => <article className="package-card" key={name}><div className="package-card__top"><span>0{index + 1}</span><span className="package-card__arrow"><ArrowRight size={17} /></span></div><h3>{name}</h3><p className="package-card__who">{who}</p><div className="package-card__meta"><span><Clock3 size={15} /> {duration}</span><strong>{price}</strong></div><p>{copy}</p><a href={`/book?source=${['Families', 'Kids', 'Adults', 'Performance'][index]}`} onClick={(e) => { e.preventDefault(); go(`/book?source=${['Families', 'Kids', 'Adults', 'Performance'][index]}`) }}>Check availability <ArrowRight size={15} /></a></article>)}</div></div></section>
}

function BookingSteps() {
  const steps = [
    ['Choose your lesson.', 'Pick Kids, Family, Adult Private or Performance Coaching.'],
    ['Send your request.', 'Share your preferred dates, group size and skill level through the short form.'],
    ['Confirm on WhatsApp.', 'The team checks instructor availability and replies with options; your lesson is confirmed only after the team replies.'],
  ]
  return <section className="section booking-steps"><div className="container"><div className="section-heading"><SectionLabel>Simple from the first message</SectionLabel><h2>How booking<br /><em>works.</em></h2></div><div className="steps-grid steps-grid--three">{steps.map(([title, copy], index) => <div className="step" key={title}><div className="step__number">0{index + 1}</div><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></div></section>
}
function SocialProof() {
  return <section className="section proof"><div className="container proof__grid"><div><SectionLabel>The iSki perspective</SectionLabel><h2>Progress you can<br /><em>feel.</em></h2><p className="lead">A good lesson helps a skier understand the movement, feel the difference and leave ready to repeat it.</p><div className="proof__rating"><strong>ISIA Level 3 · English C1</strong><span>Guest reviews will be added only when verified and approved.</span></div></div><div className="proof__quote"><span className="proof__principle">THE iSKI APPROACH</span><p>Clear feedback. Focused practice. A next step you can repeat.</p><div className="quote-author"><span className="avatar">iS</span><div><strong>How we coach</strong><span>Practical cues · on-snow feedback</span></div></div></div></div></section>
}

function KopaonikTeaser() {
  return <section className="kopaonik"><div className="container kopaonik__inner"><div><SectionLabel light>More than a destination</SectionLabel><h2>Kopaonik is<br /><em>your playground.</em></h2><p>Serbia’s leading ski resort has room for first turns, family days and performance goals. We help you choose the right slopes, equipment and lesson times.</p></div><div className="kopaonik__badge"><Mountain size={40} /><span>KOPAONIK<br /><b>SERBIA</b></span><a href="/contact" onClick={(e) => { e.preventDefault(); go('/contact') }}>Plan your visit <ArrowRight size={15} /></a></div></div></section>
}

function FAQPreview() {
  const questions = ['Do I need a ski pass?', 'Can you teach complete beginners?', 'Do instructors speak English?', 'What age can children start?', 'How do I book?']
  return <section className="section faq-preview"><div className="container faq-preview__grid"><div><SectionLabel>Good to know</SectionLabel><h2>Questions before<br /><em>your first turn?</em></h2><Button href="/faq" variant="text">See all FAQs</Button></div><div className="mini-faq">{questions.map((question, index) => <a href="/faq" key={question} onClick={(e) => { e.preventDefault(); go('/faq') }}><span>0{index + 1}</span><strong>{question}</strong><ChevronRight size={18} /></a>)}</div></div></section>
}

function FinalCTA() {
  return <section className="final-cta"><div className="container final-cta__inner"><div><SectionLabel light>Your next line starts here</SectionLabel><h2>Ready to enjoy Kopaonik<br /><em>with confidence?</em></h2></div><div className="final-cta__actions"><Button href="/book" variant="yellow">Check availability</Button><a href={waLink()} target="_blank" rel="noreferrer" className="final-cta__whatsapp"><MessageCircle size={18} /> Chat on WhatsApp</a></div></div></section>
}

function Footer() {
  return <><footer className="footer"><div className="container"><div className="footer__top"><div><BrandMark light /><p className="footer__intro">Private, family and performance ski coaching in Kopaonik, Serbia. English-first instruction for real progress on the mountain.</p><a className="footer__email" href={`mailto:${EMAIL}`}>{EMAIL}</a></div><div className="footer__col"><span className="footer__label">Explore</span><a href="/families" onClick={(e) => { e.preventDefault(); go('/families') }}>Families</a><a href="/kids" onClick={(e) => { e.preventDefault(); go('/kids') }}>Kids</a><a href="/adults" onClick={(e) => { e.preventDefault(); go('/adults') }}>Adults</a><a href="/performance" onClick={(e) => { e.preventDefault(); go('/performance') }}>Performance</a></div><div className="footer__col"><span className="footer__label">Academy</span><a href="/about/igor-andric" onClick={(e) => { e.preventDefault(); go('/about/igor-andric') }}>About Igor</a><a href="/prices" onClick={(e) => { e.preventDefault(); go('/prices') }}>Prices</a><a href="/partners" onClick={(e) => { e.preventDefault(); go('/partners') }}>Partners</a><a href="/faq" onClick={(e) => { e.preventDefault(); go('/faq') }}>FAQ</a><a href="/contact" onClick={(e) => { e.preventDefault(); go('/contact') }}>Contact</a></div><div className="footer__col"><span className="footer__label">Connect</span><a href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a><a href="https://www.instagram.com/iski.academy/" target="_blank" rel="noreferrer"><AtSign size={15} /> Instagram</a><a href="https://www.tiktok.com/@iski.academy" target="_blank" rel="noreferrer">TikTok</a><a href="https://www.facebook.com/profile.php?id=61595541632796" target="_blank" rel="noreferrer">Facebook</a></div></div><div className="footer__bottom"><span>© 2026 iSki Academy</span><span>Kopaonik, Serbia</span><span>Terms · Privacy · Cancellation policy</span></div></div></footer><SiteAudioControls /></>
}

function HomePage() { return <><Hero /><TrustBar /><ExperienceCards /><WhyISki /><FounderStrip /><HomeGallery /><Packages /><BookingSteps /><SocialProof /><KopaonikTeaser /><FAQPreview /><FinalCTA /></> }

type LandingPackage = { name: string; duration: string; group: string; ideal: string; price: string }

const landingPackages: Record<string, LandingPackage[]> = {
  families: [
    { name: 'Family Snow Start', duration: '3 × 90 min', group: 'Private family group', ideal: 'First-time families', price: '€390–440' },
    { name: 'Family Progress', duration: '5 × 90 min', group: 'Private family group', ideal: 'Families staying 5+ days', price: '€590–660' },
    { name: 'Premium Family Day', duration: '4–5 hours', group: 'Private family group', ideal: 'Short stays & international families', price: '€450–750' },
  ],
  kids: [
    { name: 'Kids Private Lesson', duration: '60 minutes', group: '1 child', ideal: 'Young or nervous children', price: '€60–70' },
    { name: 'Kids Confidence Camp', duration: '5 × 2 hours', group: 'Small group · max 3–4 children', ideal: 'Children aged 4–12', price: '€290–330 / child' },
  ],
  adults: [
    { name: 'Private Ski Lesson', duration: '60 minutes', group: '1 skier', ideal: 'Adult beginners and improvers', price: '€60–70' },
    { name: 'Semi-Private Lesson', duration: '60 minutes', group: '2 skiers', ideal: 'Couples or friends at a similar level', price: '€85–95' },
  ],
  performance: [
    { name: 'Carving & Edge Control', duration: '90 minutes', group: '1 skier · private', ideal: 'Intermediate and advanced skiers', price: '€130–150' },
    { name: 'Rhythm & Line Choice', duration: '90 minutes', group: '1 skier · private', ideal: 'Skiers refining speed and precision', price: '€130–150' },
    { name: 'Variable Snow Coaching', duration: '90 minutes', group: '1 skier · private', ideal: 'Experienced skiers building control', price: '€130–150' },
  ],
}

function ProgramPackages({ program }: { program: Program }) {
  const options = landingPackages[program.slug] || []
  if (!options.length) return null
  return <section className="section section--cream landing-packages"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Choose your format</SectionLabel><h2>Lesson options<br /><em>for {program.slug}.</em></h2></div><p>Starting prices in EUR. The team checks dates and confirms the right instructor before a lesson is booked.</p></div><div className="landing-packages__grid">{options.map((item, index) => <article className="landing-package" key={item.name}><span className="landing-package__number">0{index + 1}</span><h3>{item.name}</h3><p className="landing-package__ideal">{item.ideal}</p><div className="landing-package__details"><span>{item.duration}</span><span>{item.group}</span></div><strong>{item.price}</strong><a href="/book" onClick={(event) => { event.preventDefault(); go('/book') }}>Check availability <ArrowRight size={15} /></a></article>)}</div></div></section>
}

function ProgramPage({ program }: { program: Program }) {
  const message = `Hi iSki Academy, I would like to check availability for ${program.slug} ski lessons.`
  return <>
    <section className={`program-hero program-hero--${program.accent}`}>
      <Snowfall /><div className="container program-hero__inner"><div><SectionLabel light>{program.eyebrow} · Kopaonik</SectionLabel><h1>{program.title}</h1><p>{program.description}</p><div className="hero__actions"><Button href="/book">Check availability</Button><Button href={waLink(message)} variant="outline">Chat on WhatsApp</Button></div></div><div className="program-hero__visual-wrap"><div className="program-hero__visual"><img src={program.banner} alt={`${program.slug} ski lesson at iSKI Academy`} /></div><div className="program-hero__price-tag"><strong>{program.price}</strong><span>{program.audience}</span></div></div></div></section>
    <TrustBar />
    <section className="section program-detail"><div className="container program-detail__grid"><div><SectionLabel>Built around you</SectionLabel><h2>Clear coaching.<br /><em>Real progress.</em></h2><p className="lead">Every session is adapted to the skier in front of us. We look at balance, movement, rhythm, confidence and the terrain — then make the next step feel achievable.</p><div className="benefit-list">{program.bullets.map((bullet) => <div className="benefit" key={bullet}><span><Check size={15} /></span>{bullet}</div>)}</div></div><div className="method-card"><span className="eyebrow">The iSki method</span><h3>{program.slug === 'performance' ? 'Understand the movement.' : 'Let the learning begin with a win.'}</h3><div className="method-list">{program.method.map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong>{index < program.method.length - 1 && <i>↓</i>}</div>)}</div></div></div></section>
    <BookingSteps />
    <ProgramPackages program={program} />
    <SocialProof />
    <section className="section section--cream detail-band"><div className="container"><div className="section-heading"><SectionLabel>What your session can include</SectionLabel><h2>Progress you can<br /><em>feel.</em></h2></div><div className="detail-cards">{program.bullets.map((bullet, index) => <div className="detail-card" key={bullet}><span>0{index + 1}</span><h3>{bullet}</h3><p>{['Safety, pace and terrain matched to your confidence.', 'Small, repeatable actions that make movement click.', 'Practical feedback after each attempt.', 'A next step you can take home with you.'][index % 4]}</p></div>)}</div></div></section>
    <section className="section program-faq"><div className="container program-faq__grid"><div><SectionLabel>Good to know</SectionLabel><h2>Questions about<br /><em>{program.slug}?</em></h2><Button href="/book" variant="text">Ask us directly</Button></div><Accordion items={program.faq} /></div></section>
    <FinalCTA />
  </>
}

function AboutPage() {
  return <><section className="about-hero"><Snowfall /><div className="container about-hero__grid"><div><SectionLabel>Founder · Race Coach · ISIA Level 3</SectionLabel><h1>More than<br /><em>a ski instructor.</em></h1><p className="hero__lead">From mastering speed himself to teaching others how to master it.</p><Button href={waLink('Hi Igor, I would like to learn more about coaching in Kopaonik.')} variant="primary">Chat with Igor</Button></div><div className="about-portrait about-portrait--photo"><img src="/assets/igor-portrait.webp" alt="Igor Andrić ski instructor" /><div className="about-portrait__overlay"><span>IGOR<br /><b>ANDRIĆ</b></span><small>ATHLETE × SPORT MASTER<br />× SKI INSTRUCTOR</small></div></div></div></section><section className="section about-story"><div className="container about-story__grid"><div><SectionLabel>The athlete</SectionLabel><h2>Movement learned<br /><em>under pressure.</em></h2></div><div><p className="lead">Igor started skiing at three and reached national-level competition by eight. He became a national ski champion eight years in a row and represented Serbia on the national ski team.</p><p>His sporting background also includes ice hockey with HK Partizan and the Serbian national U18/U20 teams. Balance, reaction, coordination and decision-making under pressure became more than concepts — they became lived experience.</p></div></div></section><section className="founder-strip founder-strip--about"><div className="container founder-strip__grid"><div><SectionLabel light>The three perspectives</SectionLabel><h2>Athlete.<br />Sport master.<br /><em>Instructor.</em></h2><p>Igor holds a Master’s degree in Coaching in Sport and is an ISIA Level 3 Ski Instructor and Race Coach.</p></div><div className="credential-stack">{['National ski champion · 1997–2004', 'Serbian national ski team · 1999–2000', 'Master’s in Coaching in Sport', 'ISIA Level 3 · First Aid · Health & Safety', '17 seasons at Kopaonik · English C1'].map((item) => <div key={item}><Check size={17} />{item}</div>)}</div></div></section><section className="section timeline"><div className="container"><div className="section-heading"><SectionLabel>On the snow</SectionLabel><h2>17 seasons of<br /><em>practical coaching.</em></h2></div><div className="timeline__list">{[['2009–2018', 'Ski School Kopaonik', 'Progressed through Level 1 → 2 → 3, coaching beginners to advanced groups.'], ['2014–2016', 'Royal Ski Club', 'Technical and race training for young competitors in slalom and giant slalom.'], ['2018–2023', 'Ski School KopSport', 'Private lessons, group classes and kids’ programmes in English and Serbian.'], ['2023–2026', 'Wolf Sport Ski School', 'Private and group lessons, carving and off-piste guiding for advanced guests.'], ['2019–today', 'Sport Association “White Bear”', 'Founder, organisation, coaching and camps.']].map(([year, title, copy]) => <div className="timeline__item" key={year}><span>{year}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></div></section><section className="section about-gallery"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>On the snow</SectionLabel><h2>Igor in<br /><em>motion.</em></h2></div><p>A closer look at the movement, terrain and energy behind the iSki method.</p></div><div className="about-gallery__grid"><img src="/assets/igor-action.webp" alt="Igor skiing downhill" /><img src="/assets/igor-forest-action.webp" alt="Igor skiing near the forest" /><img src="/assets/igor-art.webp" alt="Portrait artwork of Igor in the mountains" /></div></div></section><FinalCTA /></>
}

function GalleryPage() {
  const [filter, setFilter] = useState('All')
  const [extraImages, setExtraImages] = useState<Array<{src:string;alt:string;label:string;category:string}>>([])
  const filters = ['All', 'Coaching', 'Mountain', 'Atmosphere', 'Community']
  useEffect(() => { let active = true; fetch('/api/public/content').then(r => { if (!r.ok) throw new Error('content unavailable'); return r.json() }).then(data => { if (active) setExtraImages((data.items || []).filter((item:any) => item.type === 'photo' && item.imageUrl).map((item:any) => ({src:item.imageUrl, alt:item.body || item.title, label:item.title, category:item.category || 'Community'}))) }).catch(() => {}); return () => { active = false } }, [])
  const allImages = [...galleryImages, ...extraImages]
  const visibleImages = allImages.filter((image) => filter === 'All' || image.category === filter)
  return <><section className="simple-hero simple-hero--gallery"><Snowfall /><div className="container"><SectionLabel light>The iSki season · Kopaonik</SectionLabel><h1>Experience<br /><em>the mountain.</em></h1><p>A closer look at the coaching, the terrain and the feeling of a day on snow with iSki Academy.</p><div className="gallery-hero__actions"><Button href="/book" variant="yellow">Plan your lesson</Button><span>Real coaching · Real mountain days</span></div></div></section><section className="section gallery-page"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Inside iSki</SectionLabel><h2>Every turn tells<br /><em>a story.</em></h2></div><p>Explore the people, movement and atmosphere behind your Kopaonik ski experience.</p></div><div className="gallery-filters" role="group" aria-label="Filter gallery images">{filters.map((item) => <button key={item} type="button" className={filter === item ? 'is-active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="gallery-grid">{visibleImages.map((image, index) => <figure className={`gallery-card gallery-card--${(index % 4) + 1}`} key={image.src}><img src={image.src} alt={image.alt} loading="lazy" /><figcaption><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{image.label}</strong><small>{image.category}</small></div></figcaption></figure>)}</div><div className="gallery-bottom-cta"><div><span className="eyebrow">Your day on the mountain</span><h3>Ready to make it yours?</h3><p>Tell us when you’ll be in Kopaonik and what you’d like to work on.</p></div><Button href="/book" variant="yellow">Find your lesson</Button></div></div></section><FinalCTA /></>
}

function StoriesPage() {
  const [items, setItems] = useState<Array<{id:number;type:string;title:string;body:string;imageUrl:string;category:string;slug:string}>>([])
  const [error, setError] = useState(false)
  useEffect(() => { let active = true; fetch('/api/public/content').then(r => { if (!r.ok) throw new Error('content unavailable'); return r.json() }).then(data => { if (active) setItems((data.items || []).filter((item:any) => item.type === 'post')) }).catch(() => { if (active) setError(true) }); return () => { active = false } }, [])
  return <><section className="simple-hero"><Snowfall /><div className="container"><SectionLabel light>From the mountain</SectionLabel><h1>Stories from<br /><em>iSki Academy.</em></h1><p>News, coaching notes and small moments from the Kopaonik season.</p></div></section><section className="section stories-page"><div className="container">{error ? <p>Stories are temporarily unavailable. Please try again later.</p> : items.length ? <div className="stories-grid">{items.map(item=><article className="story-card" key={item.id}>{item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy"/>}<div><span className="eyebrow">{item.category}</span><h2>{item.title}</h2><p>{item.body}</p></div></article>)}</div> : <div className="stories-empty"><h2>Good stories start<br/><em>on the mountain.</em></h2><p>We’re preparing the first iSki stories. In the meantime, explore the gallery or meet Igor.</p><Button href="/gallery" variant="yellow">Explore gallery</Button></div>}</div></section><FinalCTA /></>
}

function VisitPage() {
  const cards = [
    ['Travel to Kopaonik', 'Choose the simplest route for your arrival day, keep your first ski day calm and leave space for weather and equipment collection.', 'Start with your dates'],
    ['Book your hotel', 'Stay close to the slopes or choose a quieter base and plan a short transfer. Tell us your group size and we can suggest what to prioritise.', 'Ask for local guidance'],
    ['Book a transfer or car', 'A pre-arranged transfer keeps arrival simple. If you drive, plan for mountain roads, winter tyres and a little extra time after snowfall.', 'Plan the journey'],
    ['What to wear skiing', 'Layer for movement: a moisture-wicking base, warm mid-layer, waterproof outer layer, helmet, gloves, goggles and dry spare socks.', 'Pack with confidence'],
  ]
  return <><section className="simple-hero simple-hero--visit"><Snowfall /><div className="container"><SectionLabel light>Before you arrive</SectionLabel><h1>Plan your<br /><em>Kopaonik visit.</em></h1><p>Useful starting points for the journey, the stay and your first day on snow.</p></div></section><section className="section visit-page"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Plan your visit</SectionLabel><h2>Arrive ready<br /><em>to enjoy it.</em></h2></div><p>We focus on the coaching, but a smooth trip makes it easier to learn. Use these guides as a simple pre-arrival checklist.</p></div><div className="visit-grid">{cards.map(([title, copy, cta], index) => <article className="visit-card" key={title}><span className="visit-card__number">0{index + 1}</span><h3>{title}</h3><p>{copy}</p><a href={waLink(`Hi iSki Academy, I would like help to ${cta.toLowerCase()} for my Kopaonik trip.`)} target="_blank" rel="noreferrer">{cta} <ArrowRight size={15} /></a></article>)}</div></div></section><section className="section visit-checklist"><div className="container visit-checklist__grid"><div><SectionLabel>Simple checklist</SectionLabel><h2>Good planning<br /><em>feels light.</em></h2></div><div className="checklist-list">{['Send your dates and group details', 'Confirm hotel and arrival transport', 'Arrange ski pass and equipment rental', 'Pack layers, gloves, goggles and a helmet', 'Message iSki before your first lesson'].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><Check size={16} /></div>)}</div></div></section><FinalCTA /></>
}

function PricesPage() {
  const prices = [
    ['Family Snow Start', 'First-time families', '3 × 90-minute private sessions', '€390–440'],
    ['Family Progress', 'Families staying 5+ days', '5 × 90-minute sessions + progress report', '€590–660'],
    ['Premium Family Day', 'Short stays & international families', '4–5 hours, family plan + video option', '€450–750'],
    ['Kids Private Lesson', 'Young or nervous children', '60-minute private session', '€60–70'],
    ['Kids Confidence Camp', 'Children aged 4–12', '5 × 2-hour small-group sessions', '€290–330 / child'],
    ['Private Lesson', 'Adults & improvers', '60-minute private session', '€60–70'],
    ['Semi-Private Lesson', 'Couples or friends', '60-minute session for two', '€85–95'],
    ['Performance Session', 'Intermediate & advanced', '90-minute coaching with Igor', '€130–150'],
  ]
  return <><section className="simple-hero"><Snowfall /><div className="container"><SectionLabel light>Packages & planning</SectionLabel><h1>Choose your<br /><em>next turn.</em></h1><p>Thoughtful coaching for families, first-timers and ambitious skiers. Clear guide prices, personal advice and no pressure to choose before you are ready.</p></div></section><section className="section prices"><div className="container"><div className="prices-intro"><div><SectionLabel>Clear pricing · Personal coaching</SectionLabel><h2>Find the right<br /><em>way to ski.</em></h2></div><p>Choose the format that fits your group and goals. These are guide prices in EUR; final availability and payment are handled through SimplyBook.me.</p></div><div className="prices-grid">{prices.map(([name, who, includes, price], index) => { const source = name.toLowerCase().includes('family') ? 'Families' : name.toLowerCase().includes('kid') ? 'Kids' : name.toLowerCase().includes('performance') ? 'Performance' : 'Adults'; const featured = name === 'Private Lesson' || name === 'Performance Session'; return <article className={`price-card ${featured ? 'price-card--featured' : ''}`} key={name}><div className="price-card__top"><span className="price-card__index">{String(index + 1).padStart(2, '0')}</span>{featured && <span className="price-card__tag">Popular choice</span>}</div><span className="price-card__audience">{who}</span><h3>{name}</h3><p className="price-card__includes">{includes}</p><div className="price-card__price"><small>Guide price</small><strong>{price}</strong></div><a className="price-card__cta" href={`/book?source=${source}`} aria-label={`Book ${name}`} onClick={(e) => { e.preventDefault(); go(`/book?source=${source}`) }}>Book with SimplyBook.me <ArrowRight size={16} /></a></article>})}</div><div className="prices-note"><ShieldCheck size={20} /><p><strong>Know before you book.</strong> Ski passes and equipment rental are separate unless arranged in advance. Confirm availability, group size, lesson format and cancellation terms on SimplyBook.me before paying.</p></div><div className="prices-help"><span>Not sure which option fits?</span><p>Share your dates, ages and experience level. We’ll help you choose a suitable lesson.</p><Button href="/book" variant="yellow">Help me choose</Button></div></div></section><FinalCTA /></>
}

function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return <div className="accordion">{items.map((item, index) => <div className={`accordion__item ${open === index ? 'is-open' : ''}`} key={item.q}><button onClick={() => setOpen(open === index ? null : index)}><span>{item.q}</span>{open === index ? <X size={17} /> : <PlusIcon />}</button>{open === index && <p>{item.a}</p>}</div>)}</div>
}
function PlusIcon() { return <span className="plus-icon"><span /><span /></span> }

function FAQPage() {
  const all = programs.flatMap((program) => program.faq).concat([
    { q: 'Do instructors speak English?', a: 'Yes. English-first instruction is central to iSki Academy. Igor speaks English at C1 level.' },
    { q: 'How do I book?', a: 'Use the external booking partner linked on our booking page, or message iSki on WhatsApp if you need help choosing a lesson.' },
    { q: 'Do I need my own equipment?', a: 'No. Rental equipment is available in Kopaonik and iSki can advise on fitting.' },
  ])
  return <><section className="simple-hero simple-hero--faq"><Snowfall /><div className="container"><SectionLabel light>Before you arrive</SectionLabel><h1>Good questions<br /><em>make good skiing.</em></h1><p>Here are the answers guests ask before their first message.</p></div></section><section className="section faq-page"><div className="container faq-page__grid"><div className="faq-page__intro"><SectionLabel>iSki answers</SectionLabel><h2>Everything you need<br /><em>to feel ready.</em></h2><p>Still unsure? Send us your dates and we will help you choose.</p><Button href="/book" variant="text">Ask a question</Button></div><Accordion items={all} /></div></section><FinalCTA /></>
}

function PartnersPage() {
  const partnerMessage = 'Hi iSki Academy, I am interested in discussing a local partnership in Kopaonik.'
  const partnerTypes = [
    ['Hotels & chalets', 'A simple ski-coaching option for guests planning their winter stay.'],
    ['Travel & transfer teams', 'Help international visitors connect their arrival plans with time on the snow.'],
    ['Mountain services', 'Coordinate useful local recommendations around lessons, rental and resort days.'],
  ]
  return <><section className="simple-hero simple-hero--partners"><Snowfall /><div className="container"><SectionLabel light>For local businesses</SectionLabel><h1>Better winter,<br /><em>together.</em></h1><p>We work with Kopaonik partners who want international guests to feel looked after from arrival to first turn.</p><Button href={waLink(partnerMessage)} variant="yellow">Talk about a partnership</Button></div></section><section className="section partners-page"><div className="container"><div className="section-heading section-heading--split"><div><SectionLabel>Local collaboration</SectionLabel><h2>Good guest days<br /><em>are a team effort.</em></h2></div><p>We keep partnerships personal, practical and centred on the visitor. Tell us what your guests need and we can explore a fit.</p></div><div className="partners-grid">{partnerTypes.map(([title, copy], index) => <article className="partner-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="partners-contact"><p>Interested in working together?</p><a className="btn btn--primary" href={waLink(partnerMessage)} target="_blank" rel="noreferrer">Message the iSki team <MessageCircle size={17} /></a></div></div></section><FinalCTA /></>
}

function NotFoundPage() {
  return <section className="simple-hero not-found"><Snowfall /><div className="container"><SectionLabel light>Trail not found</SectionLabel><h1>This page<br /><em>ends here.</em></h1><p>Let’s get you back to the mountain or help you check a lesson date.</p><Button href="/" variant="yellow">Back to iSki Academy</Button></div></section>
}

function ContactPage() {
  return <><section className="simple-hero simple-hero--contact"><Snowfall /><div className="container"><SectionLabel light>Find your way to the snow</SectionLabel><h1>Let's talk<br /><em>skiing.</em></h1><p>Tell us your dates, your level and what you want to feel on the mountain.</p></div></section><section className="section contact"><div className="container contact__grid"><div><SectionLabel>Contact iSki Academy</SectionLabel><h2>Your next lesson<br /><em>starts here.</em></h2><p className="lead">The fastest way to check availability is WhatsApp. You can also email us with your dates and questions.</p><div className="contact-cards"><a href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={22} /><span><small>WhatsApp</small><strong>+381 63 1016260</strong></span><ArrowRight size={18} /></a><a href={`mailto:${EMAIL}`}><MessageCircle size={22} /><span><small>Email</small><strong>{EMAIL}</strong></span><ArrowRight size={18} /></a><div><MapPin size={22} /><span><small>Based in</small><strong>Kopaonik, Serbia</strong></span></div></div></div><div className="contact-social"><span className="eyebrow">Follow the season</span><a href="https://www.instagram.com/iski.academy/" target="_blank" rel="noreferrer"><AtSign size={20} /> Instagram <ArrowRight size={17} /></a><a href="https://www.tiktok.com/@iski.academy" target="_blank" rel="noreferrer">TikTok <ArrowRight size={17} /></a><a href="https://www.facebook.com/profile.php?id=61595541632796" target="_blank" rel="noreferrer">Facebook <ArrowRight size={17} /></a><div className="contact-social__mark"><Mountain size={44} /><span>MEET YOU<br /><b>ON THE SLOPE</b></span></div></div></div></section><FinalCTA /></>
}

function BookPage({ source: _source }: { source: string }) {
  const bookingUrl = SIMPLYBOOK_URL
  return <><section className="simple-hero simple-hero--book"><Snowfall /><div className="container"><SectionLabel light>Simple booking</SectionLabel><h1>Book your<br /><em>mountain time.</em></h1><p>iSki Academy keeps the website simple. Choose your lesson through SimplyBook.me, or message us directly if you need personal guidance.</p></div></section><section className="section booking-page"><div className="container booking-simple"><div className="booking-simple__card"><span className="eyebrow">One simple next step</span><h2>Choose your lesson.<br /><em>We’ll take it from there.</em></h2><p>Booking and payment are handled by SimplyBook.me. You can return to iSki Academy any time for coaching information, prices and photos.</p><div className="booking-simple__actions">{bookingUrl ? <a className="btn btn--yellow" href={bookingUrl} target="_blank" rel="noopener noreferrer">Book with SimplyBook.me <ArrowRight size={17}/></a> : <a className="btn btn--yellow" href={waLink('Hi iSki Academy, please send me the external booking link and help me choose a ski lesson.')} target="_blank" rel="noreferrer">Ask for the booking link <MessageCircle size={17}/></a>}<a className="btn btn--outline" href={waLink()} target="_blank" rel="noreferrer">Message on WhatsApp <MessageCircle size={17}/></a></div><small>{bookingUrl ? 'You will continue securely on the SimplyBook.me booking page.' : 'SimplyBook.me is not connected yet. Add your booking-page URL as VITE_SIMPLYBOOK_URL before publishing.'}</small></div></div></section><FinalCTA /></>
}

export default function App({ initialUrl = '/' }: { initialUrl?: string }) {
  const [location, setLocation] = useState(initialUrl)
  const path = normalizePath(location)
  const query = new URLSearchParams(location.split('?')[1]?.split('#')[0] || '')
  const utmSource = (query.get('utm_source') || '').toLowerCase()
  const inferredSource = utmSource.includes('instagram') ? 'Instagram' : utmSource.includes('google') ? 'Google' : 'Google'
  const source = query.get('source') || inferredSource

  useEffect(() => {
    const syncLocation = () => setLocation(`${window.location.pathname}${window.location.search}`)
    syncLocation()
    window.addEventListener('popstate', syncLocation)
    return () => window.removeEventListener('popstate', syncLocation)
  }, [])

  useEffect(() => {
    applyPageMetadata(path)
    if (!path.startsWith('/admin')) trackConversion('page_view', { page_path: path })
  }, [path])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a')
      const href = anchor?.getAttribute('href') || ''
      if (href.startsWith('tel:')) trackConversion('phone_click', { page_path: path })
      if (href.startsWith('https://wa.me/')) trackConversion('whatsapp_click', { page_path: path })
    }
    document.addEventListener('click', handleClick)

    let observer: IntersectionObserver | undefined
    if ('IntersectionObserver' in window) {
      const seen = new WeakSet<Element>()
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue
          seen.add(entry.target)
          const packageName = entry.target.querySelector('h3')?.textContent?.trim()
          trackConversion('package_view', { package_name: packageName, page_path: path })
        }
      }, { threshold: 0.45 })
      document.querySelectorAll('.package-card, .landing-package, .price-row').forEach((item) => observer?.observe(item))
    }

    return () => {
      document.removeEventListener('click', handleClick)
      observer?.disconnect()
    }
  }, [path])

  const content = useMemo(() => {
    if (path === '/') return <HomePage />
    if (path === '/about/igor-andric') return <AboutPage />
    if (path === '/prices') return <PricesPage />
    if (path === '/gallery') return <GalleryPage />
    if (path === '/stories') return <StoriesPage />
    if (path === '/plan-your-visit') return <VisitPage />
    if (path === '/faq') return <FAQPage />
    if (path === '/contact') return <ContactPage />
    if (path === '/partners') return <PartnersPage />
    if (path === '/book') return <BookPage source={source} />
    const program = programs.find((item) => `/${item.slug}` === path)
    return program ? <ProgramPage program={program} /> : <NotFoundPage />
  }, [path, source])

  if (path === '/admin' || path.startsWith('/admin/')) return <AdminApp />

  return <div className="app"><Header path={path} /><main>{content}</main><Footer /><a className="whatsapp-float" href={waLink()} target="_blank" rel="noreferrer" aria-label="Chat with iSki Academy on WhatsApp"><MessageCircle size={19} /><span>WhatsApp</span></a><div className="mobile-bar"><a href="/book" onClick={(event) => { event.preventDefault(); go('/book') }}><Check size={16} /> Check availability</a><a href={waLink()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><MessageCircle size={17} /></a><a href="tel:+381631016260" aria-label="Call iSki Academy"><Phone size={17} /></a></div></div>
}
