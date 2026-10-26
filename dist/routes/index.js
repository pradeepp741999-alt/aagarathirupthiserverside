"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dates_1 = require("@/common/utils/dates");
const auth_routes_1 = require("@/modules/auth/auth.routes");
const master_routes_1 = require("@/modules/master/master.routes");
const media_routes_1 = require("@/modules/media/media.routes");
const users_routes_1 = require("@/modules/users/users.routes");
const requirements_routes_1 = require("@/modules/requirements/requirements.routes");
const combos_routes_1 = require("@/modules/catalog/combos/combos.routes");
const registration_routes_1 = require("@/modules/providers/registration/registration.routes");
const me_routes_1 = require("@/modules/providers/me/me.routes");
const documents_routes_1 = require("@/modules/providers/documents/documents.routes");
const dishes_routes_1 = require("@/modules/catalog/dishes/dishes.routes");
const packages_routes_1 = require("@/modules/catalog/packages/packages.routes");
const availability_routes_1 = require("@/modules/availability/availability.routes");
const reviews_routes_1 = require("@/modules/reviews/reviews.routes");
const earnings_routes_1 = require("@/modules/earnings/earnings.routes");
const public_routes_1 = require("@/modules/providers/public/public.routes");
const enquiries_routes_1 = require("@/modules/enquiries/enquiries.routes");
const bookings_routes_1 = require("@/modules/bookings/bookings.routes");
const crm_routes_1 = require("@/modules/crm/crm.routes");
const dashboard_routes_1 = require("@/modules/dashboard/dashboard.routes");
const analytics_routes_1 = require("@/modules/analytics/analytics.routes");
const notifications_routes_1 = require("@/modules/notifications/notifications.routes");
const support_routes_1 = require("@/modules/support/support.routes");
const admin_routes_1 = require("@/modules/admin/admin.routes");
const router = (0, express_1.Router)();
// 1. Health check
router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: (0, dates_1.nowIST)().toISOString(),
    });
});
// 2. Auth routes (/api/v1/auth/*)
router.use(auth_routes_1.authRoutes);
// 3. Master & metadata routes (/api/v1/app/*, /api/v1/categories/*, /api/v1/districts, /api/v1/config/*)
router.use(master_routes_1.masterRoutes);
// 4. Media routes (/api/v1/media/*)
router.use(media_routes_1.mediaRoutes);
// 5. User profile & location routes (/api/v1/user/*)
router.use(users_routes_1.usersRoutes);
// 6. Requirements draft routes (/api/v1/requirements/*)
router.use(requirements_routes_1.requirementsRoutes);
// 7. Combos public & alias routes (/api/v1/combos/*)
router.use(combos_routes_1.combosPublicRoutes);
// 8. Providers sub-router (CRITICAL: Static routes MUST precede parameterized /:id routes)
const providersRouter = (0, express_1.Router)();
providersRouter.use(registration_routes_1.registrationRoutes); // /registration/*
providersRouter.use(me_routes_1.meRoutes); // /me, /me/status, /settings
providersRouter.use(documents_routes_1.documentsRoutes); // /documents, /documents/:type
providersRouter.use(dishes_routes_1.dishesRoutes); // /dishes, /dishes/:id
providersRouter.use(packages_routes_1.packagesRoutes); // /packages, /packages/:id
providersRouter.use(combos_routes_1.combosRoutes); // /combos, /combos/:id
providersRouter.use(availability_routes_1.availabilityRoutes); // /availability/month, /availability/date, /availability/bulk
providersRouter.use(reviews_routes_1.reviewsProviderRoutes); // /reviews, /reviews/summary, /reviews/:id/reply
providersRouter.use(earnings_routes_1.earningsRoutes); // /earnings/summary, /earnings/transactions
providersRouter.use(public_routes_1.publicProvidersRoutes); // /nearby, /match, /, /:id, /:id/calendar, /:id/availability, etc.
router.use('/providers', providersRouter);
// 9. Enquiries shared router (/api/v1/enquiries/*)
router.use('/enquiries', enquiries_routes_1.enquiriesRoutes);
// 10. Bookings provider router (/api/v1/bookings/*)
router.use('/bookings', bookings_routes_1.bookingsRoutes);
// 11. CRM provider router (/api/v1/crm/*)
router.use('/crm', crm_routes_1.crmRoutes);
// 12. Dashboard provider router (/api/v1/dashboard/*)
router.use('/dashboard', dashboard_routes_1.dashboardRoutes);
// 13. Analytics provider router (/api/v1/analytics/*)
router.use('/analytics', analytics_routes_1.analyticsRoutes);
// 14. Reviews user submission router (/api/v1/reviews)
router.use('/reviews', reviews_routes_1.reviewsUserRoutes);
// 15. Notifications shared router (/api/v1/notifications/*)
router.use('/notifications', notifications_routes_1.notificationsRoutes);
// 16. Support router (/api/v1/support/*)
router.use('/support', support_routes_1.supportRoutes);
// 17. Admin router (/api/v1/admin/*)
router.use('/admin', admin_routes_1.adminRoutes);
exports.default = router;
