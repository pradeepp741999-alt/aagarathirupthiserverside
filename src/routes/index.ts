import { Router } from 'express';
import { nowIST } from '@/common/utils/dates';
import { authRoutes } from '@/modules/auth/auth.routes';
import { masterRoutes } from '@/modules/master/master.routes';
import { mediaRoutes } from '@/modules/media/media.routes';
import { usersRoutes } from '@/modules/users/users.routes';
import { requirementsRoutes } from '@/modules/requirements/requirements.routes';
import { combosRoutes, combosPublicRoutes } from '@/modules/catalog/combos/combos.routes';
import { registrationRoutes } from '@/modules/providers/registration/registration.routes';
import { meRoutes } from '@/modules/providers/me/me.routes';
import { documentsRoutes } from '@/modules/providers/documents/documents.routes';
import { dishesRoutes } from '@/modules/catalog/dishes/dishes.routes';
import { packagesRoutes } from '@/modules/catalog/packages/packages.routes';
import { availabilityRoutes } from '@/modules/availability/availability.routes';
import { reviewsUserRoutes, reviewsProviderRoutes } from '@/modules/reviews/reviews.routes';
import { earningsRoutes } from '@/modules/earnings/earnings.routes';
import { publicProvidersRoutes } from '@/modules/providers/public/public.routes';
import { enquiriesRoutes } from '@/modules/enquiries/enquiries.routes';
import { bookingsRoutes } from '@/modules/bookings/bookings.routes';
import { crmRoutes } from '@/modules/crm/crm.routes';
import { dashboardRoutes } from '@/modules/dashboard/dashboard.routes';
import { analyticsRoutes } from '@/modules/analytics/analytics.routes';
import { notificationsRoutes } from '@/modules/notifications/notifications.routes';
import { supportRoutes } from '@/modules/support/support.routes';
import { adminRoutes } from '@/modules/admin/admin.routes';

const router = Router();

// 1. Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: nowIST().toISOString(),
  });
});

// 2. Auth routes (/api/v1/auth/*)
router.use(authRoutes);

// 3. Master & metadata routes (/api/v1/app/*, /api/v1/categories/*, /api/v1/districts, /api/v1/config/*)
router.use(masterRoutes);

// 4. Media routes (/api/v1/media/*)
router.use(mediaRoutes);

// 5. User profile & location routes (/api/v1/user/*)
router.use(usersRoutes);

// 6. Requirements draft routes (/api/v1/requirements/*)
router.use(requirementsRoutes);

// 7. Combos public & alias routes (/api/v1/combos/*)
router.use(combosPublicRoutes);

// 8. Providers sub-router (CRITICAL: Static routes MUST precede parameterized /:id routes)
const providersRouter = Router();
providersRouter.use(registrationRoutes);       // /registration/*
providersRouter.use(meRoutes);                 // /me, /me/status, /settings
providersRouter.use(documentsRoutes);          // /documents, /documents/:type
providersRouter.use(dishesRoutes);             // /dishes, /dishes/:id
providersRouter.use(packagesRoutes);           // /packages, /packages/:id
providersRouter.use(combosRoutes);             // /combos, /combos/:id
providersRouter.use(availabilityRoutes);       // /availability/month, /availability/date, /availability/bulk
providersRouter.use(reviewsProviderRoutes);    // /reviews, /reviews/summary, /reviews/:id/reply
providersRouter.use(earningsRoutes);           // /earnings/summary, /earnings/transactions
providersRouter.use(publicProvidersRoutes);    // /nearby, /match, /, /:id, /:id/calendar, /:id/availability, etc.

router.use('/providers', providersRouter);

// 9. Enquiries shared router (/api/v1/enquiries/*)
router.use('/enquiries', enquiriesRoutes);

// 10. Bookings provider router (/api/v1/bookings/*)
router.use('/bookings', bookingsRoutes);

// 11. CRM provider router (/api/v1/crm/*)
router.use('/crm', crmRoutes);

// 12. Dashboard provider router (/api/v1/dashboard/*)
router.use('/dashboard', dashboardRoutes);

// 13. Analytics provider router (/api/v1/analytics/*)
router.use('/analytics', analyticsRoutes);

// 14. Reviews user submission router (/api/v1/reviews)
router.use('/reviews', reviewsUserRoutes);

// 15. Notifications shared router (/api/v1/notifications/*)
router.use('/notifications', notificationsRoutes);

// 16. Support router (/api/v1/support/*)
router.use('/support', supportRoutes);

// 17. Admin router (/api/v1/admin/*)
router.use('/admin', adminRoutes);

export default router;
