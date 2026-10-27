Build a simple, fast, mobile-first booking platform for iSki Academy, a premium English-first ski school in Kopaonik, Serbia, launching for the 2026–2027 winter season.

Do NOT build a complex marketplace or full SaaS system like Bloowatch. Build a lightweight, conversion-focused website with a simple internal booking/enquiry system for a small team: 1 founder and 5 ski instructors.

## Business context
- Brand: iSki Academy
- Location: Kopaonik, Serbia
- Audience: international English-speaking families, kids, adults, and advanced skiers
- Positioning: premium, personal, English-language ski instruction
- Main conversion channels: website booking form and WhatsApp
- Team size: 1 founder + 5 instructors
- Season: winter 2026–2027
- Main goal: turn website visitors into qualified booking enquiries, then close bookings through WhatsApp

## Core requirement
Create a clean, premium, mobile-first website with these public pages:

1. Homepage: iskiacademy.com
2. Families: /families
3. Kids: /kids
4. Adults: /adults
5. Performance: /performance
6. Booking page: /book
7. Partner page: /partners
8. Contact page: /contact

Use one domain with subdirectories, not separate domains. All pages must share the same brand identity, header, footer, booking system, analytics and SEO setup.

## Landing page structure
For each audience landing page, use this conversion-focused structure:

1. Hero: clear promise, target audience, primary CTA “Check Availability” and secondary CTA “Chat on WhatsApp”
2. Trust bar: instructor certifications, years of experience, languages, safety, Google reviews if available
3. Problem: explain the guest’s pain point in simple English
4. Solution: how iSki Academy solves it
5. How it works: 3 simple steps — choose lesson type, send request, confirm on WhatsApp
6. Packages: show 2–3 clear lesson packages with duration, group size, ideal guest and starting price
7. Social proof: testimonials, photos, short video, review highlights
8. FAQ: 5–7 questions relevant to that audience
9. Final CTA: booking form + WhatsApp button

Keep copy in clear, simple, premium English. Avoid generic phrases like “best ski school”. Use outcome-based language such as “confident first turns”, “safe and fun kids’ lessons”, “faster progression”, “private coaching for strong skiers”.

## Booking system requirements
Build a simple booking enquiry system, not a full real-time calendar marketplace.

The booking form must be short and mobile-friendly. Required fields:
- Full name
- Email
- WhatsApp number
- Lesson type: Kids / Family / Adult Private / Performance Coaching
- Preferred dates
- Number of participants
- Skill level: First timer / Beginner / Intermediate / Advanced
- Preferred instructor, optional
- Message, optional
- Source: Families / Kids / Adults / Performance / Partner / Instagram / Google

After submission:
- Save the enquiry in an admin dashboard
- Send an automatic confirmation email to the guest
- Notify the iSki admin by email
- Create a pre-filled WhatsApp message with the booking details
- Show a thank-you page with a WhatsApp CTA

The admin dashboard must be simple and include:
- List of all bookings with status: New, Contacted, Confirmed, Deposit Paid, Completed, Cancelled
- Filter by date, lesson type, instructor and status
- Booking detail page
- Ability to add internal notes
- Export bookings to CSV
- Basic instructor availability calendar

Do not require customers to create an account. Keep the guest flow under 60 seconds.

## WhatsApp integration
Add a persistent WhatsApp button on every page.
Use click-to-chat links with pre-filled messages such as:
- “Hi iSki Academy, I’d like to check availability for ski lessons in Kopaonik.”
- “Hi iSki Academy, I’m interested in kids’ ski lessons.”
- “Hi iSki Academy, I’d like to book a private lesson.”

Track WhatsApp clicks as conversion events.

## Payments
For version 1, do not build a full payment gateway.
Instead, support:
- Manual deposit payment link, for example Stripe Payment Link
- Booking status: Deposit Paid
- Ability to attach or send a payment link after confirmation

Later, allow optional online deposit payment directly from the booking confirmation page.

## Design requirements
- Premium, clean, modern, alpine aesthetic
- White space, strong typography, high-quality ski photography
- Mobile-first and extremely fast
- Clear CTA buttons: “Check Availability” and “Chat on WhatsApp”
- Accessible contrast and readable text
- No clutter, no complex menus, no unnecessary animations

## SEO requirements
- SEO-friendly URLs
- Unique title tags and meta descriptions for every page
- Schema markup for LocalBusiness, SkiSchool, FAQPage and Review where relevant
- Optimise for keywords such as:
  - ski school Kopaonik
  - English speaking ski instructor Kopaonik
  - kids ski lessons Kopaonik
  - private ski lessons Kopaonik
  - family ski lessons Kopaonik
- Add Open Graph tags for social sharing
- Create an XML sitemap and robots.txt
- Optimise images with alt text and lazy loading

## Tracking
Integrate:
- Google Analytics 4
- Google Tag Manager
- Meta Pixel
- Conversion events for:
  - booking form submitted
  - WhatsApp click
  - phone click
  - package view
  - booking confirmation page view

## Technical preferences
- Use a modern, maintainable stack suitable for a small business
- Prefer Next.js or a similar fast framework
- Use a simple database for bookings and instructors
- Provide an admin login for iSki staff
- Make the platform easy to update without developer help
- Ensure the site loads quickly on mobile
- Prepare for future additions: online payments, instructor profiles, blog, multilingual support

## Deliverables
Please deliver:
1. Full website with all pages
2. Booking form and admin dashboard
3. WhatsApp integration
4. SEO setup
5. Analytics setup
6. Mobile-responsive design
7. Clear documentation for updating packages, prices, FAQs, instructors and availability
8. A simple deployment setup

Prioritise speed, simplicity, premium brand feel and WhatsApp booking conversions. Avoid overbuilding. The platform should feel like a polished boutique ski academy website with a lightweight booking engine, not a complicated travel marketplace.