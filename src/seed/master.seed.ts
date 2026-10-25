import bcrypt from 'bcryptjs';
import { Category } from '@/models/Category';
import { District } from '@/models/District';
import { OnboardingSlide } from '@/models/OnboardingSlide';
import { Faq } from '@/models/Faq';
import { Admin } from '@/models/Admin';
import { Counter } from '@/models/Counter';
import { TN_DISTRICTS } from './districts.data';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

export async function seedMasterData(): Promise<void> {
  logger.info('Seeding master data...');

  // 1. Categories
  const categoriesData = [
    {
      _id: 'catering',
      name: 'Catering',
      icon: 'restaurant',
      providerIcon: 'utensils',
      color: '#F97316',
      description: 'Authentic South & North Indian event catering with custom menus and live counters.',
      startingPriceHint: 250,
      highlights: ['Customizable Menus', 'Live Cooking Stalls', 'Trained Serving Staff', 'Hygienic Preparation'],
      serviceScope: ['Weddings', 'Receptions', 'Birthdays', 'Corporate Buffets', 'Housewarming'],
      eventTypes: [
        'Wedding',
        'Reception',
        'Engagement',
        'Housewarming',
        'Birthday',
        'Temple / Festival',
        'Corporate Event',
      ],
      services: ['Breakfast', 'Lunch', 'Dinner', 'Snacks & Beverages', 'Live Counters'],
      sortOrder: 1,
      isActive: true,
    },
    {
      _id: 'decoration',
      name: 'Decoration',
      icon: 'color-wand',
      providerIcon: 'sparkles',
      color: '#8B5CF6',
      description: 'Stunning floral backdrops, traditional stage decors, and contemporary theme setups.',
      startingPriceHint: 15000,
      highlights: ['Fresh Floral Mandaps', 'Custom Theme Backdrops', 'LED Stage Lighting', 'Welcome Arches'],
      serviceScope: ['Weddings', 'Receptions', 'Engagements', 'Haldi/Mehendi', 'Birthdays'],
      eventTypes: ['Wedding Mandap', 'Reception Stage', 'Engagement', 'Housewarming', 'Birthday'],
      services: ['Floral Backdrop', 'Stage Lighting', 'Theme Setup', 'Entrance Decor'],
      sortOrder: 2,
      isActive: true,
    },
    {
      _id: 'audio',
      name: 'Audio & Sound',
      icon: 'musical-notes',
      providerIcon: 'volume-2',
      color: '#3B82F6',
      description: 'Professional line array acoustics, DJ dance floors, and live sound engineering.',
      startingPriceHint: 8000,
      highlights: ['JBL/RCF Line Arrays', 'Wireless Microphones', 'DJ Lighting & Fog', 'Live Sound Engineers'],
      serviceScope: ['Concerts', 'Weddings', 'Sangeet Nights', 'Corporate Events'],
      eventTypes: ['Wedding', 'Reception', 'Orchestra / Concert', 'Birthday', 'Corporate Event'],
      services: ['Line Array Sound', 'DJ Setup', 'Live Mikes', 'Orchestra'],
      sortOrder: 3,
      isActive: true,
    },
    {
      _id: 'makeup',
      name: 'Bridal Makeup',
      icon: 'sparkles',
      providerIcon: 'smile',
      color: '#EC4899',
      description: 'HD & Airbrush bridal makeovers, professional saree draping, and elegant hairstyling.',
      startingPriceHint: 12000,
      highlights: ['HD & Airbrush Techniques', 'Premium International Brands', 'On-Venue Bridal Trials', 'Saree Draping Included'],
      serviceScope: ['Muhurtham', 'Reception', 'Engagement', 'Pre-Wedding Shoots'],
      eventTypes: ['Bridal (Muhurtham)', 'Reception', 'Engagement', 'Sangeet / Mehendi'],
      services: ['HD Bridal Makeup', 'Airbrush Makeover', 'Saree Draping', 'Bridal Hairstyling'],
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const cat of categoriesData) {
    await Category.findByIdAndUpdate(cat._id, cat, { upsert: true, new: true });
  }

  // 2. Districts
  for (const d of TN_DISTRICTS) {
    await District.findByIdAndUpdate(
      d._id,
      {
        _id: d._id,
        name: d.name,
        isDefault: d.isDefault,
        lat: d.lat,
        lng: d.lng,
        areas: d.areas,
        isActive: true,
      },
      { upsert: true, new: true }
    );
  }

  // 3. Onboarding Slides
  const userSlides = [
    {
      role: 'user' as const,
      order: 1,
      title: 'Welcome to Aagara Thirupthi',
      subtitle: "Discover Salem's best catering, decor, makeup & sound services",
      image: `${env.CDN_BASE_URL}/onboarding/slide_1.png`,
      isActive: true,
    },
    {
      role: 'user' as const,
      order: 2,
      title: 'Compare and Build Requirements',
      subtitle: 'Customize menus, verify live availability, and request direct quotes',
      image: `${env.CDN_BASE_URL}/onboarding/slide_2.png`,
      isActive: true,
    },
    {
      role: 'user' as const,
      order: 3,
      title: 'Book with Direct Trust',
      subtitle: 'Connect with verified local professionals and track bookings seamlessly',
      image: `${env.CDN_BASE_URL}/onboarding/slide_3.png`,
      isActive: true,
    },
  ];

  const providerSlides = [
    {
      role: 'provider' as const,
      order: 1,
      title: 'Reach More Local Clients',
      subtitle: 'Showcase your portfolio, packages, and custom dishes to families in Salem & TN',
      image: `${env.CDN_BASE_URL}/onboarding/provider_slide_1.png`,
      isActive: true,
    },
    {
      role: 'provider' as const,
      order: 2,
      title: 'Manage Bookings & Calendars',
      subtitle: 'Respond to enquiries, send quotes, track payments, and block busy event dates',
      image: `${env.CDN_BASE_URL}/onboarding/provider_slide_2.png`,
      isActive: true,
    },
    {
      role: 'provider' as const,
      order: 3,
      title: 'Build Credibility with Real Reviews',
      subtitle: 'Collect customer feedback and unlock verified badges to grow your reputation',
      image: `${env.CDN_BASE_URL}/onboarding/provider_slide_3.png`,
      isActive: true,
    },
  ];

  for (const slide of [...userSlides, ...providerSlides]) {
    await OnboardingSlide.findOneAndUpdate(
      { role: slide.role, order: slide.order },
      slide,
      { upsert: true, new: true }
    );
  }

  // 4. FAQs
  const faqsData = [
    {
      role: 'provider' as const,
      order: 1,
      question: 'When are earnings and payouts settled?',
      answer: 'Earnings are settled weekly on Tuesdays directly to your verified bank account via NEFT/UPI.',
      isActive: true,
    },
    {
      role: 'provider' as const,
      order: 2,
      question: 'Is FSSAI registration mandatory for caterers?',
      answer: 'FSSAI is optional during registration but required to unlock the Verified Caterer badge on your public profile.',
      isActive: true,
    },
    {
      role: 'provider' as const,
      order: 3,
      question: 'How do customer enquiries work?',
      answer: 'When a customer submits an event requirement, you receive a notification. You can review details and send a formal quote.',
      isActive: true,
    },
    {
      role: 'user' as const,
      order: 1,
      question: 'How do I contact service providers on Aagara Thirupthi?',
      answer: 'Browse verified providers, customize your event requirement, and submit an enquiry to receive custom quotes and direct phone/WhatsApp contact.',
      isActive: true,
    },
    {
      role: 'user' as const,
      order: 2,
      question: 'How are payments made for my event?',
      answer: 'Advance and balance payments are made directly to the provider via UPI, bank transfer, or cash. Providers issue official digital receipts through the platform.',
      isActive: true,
    },
    {
      role: 'user' as const,
      order: 3,
      question: 'Can I cancel an enquiry or booking?',
      answer: 'Yes, you can cancel an enquiry at any stage before confirmation. Post-confirmation cancellations are subject to the provider terms.',
      isActive: true,
    },
  ];

  for (const faq of faqsData) {
    await Faq.findOneAndUpdate(
      { role: faq.role, question: faq.question },
      faq,
      { upsert: true, new: true }
    );
  }

  // 5. Initial Admin Account
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  await Admin.findOneAndUpdate(
    { email: env.ADMIN_EMAIL.toLowerCase() },
    {
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      name: 'Platform Administrator',
      isActive: true,
    },
    { upsert: true, new: true }
  );

  // 6. Sequential Counters
  const counterKeys = ['enquiry', 'booking', 'receipt', 'invoice', 'ticket'];
  for (const key of counterKeys) {
    await Counter.findByIdAndUpdate(
      key,
      { $setOnInsert: { _id: key, seq: 0 } },
      { upsert: true }
    );
  }

  logger.info('Master data seeded successfully!');
}
