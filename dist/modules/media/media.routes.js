"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = void 0;
const express_1 = require("express");
const media_controller_1 = require("./media.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const validate_1 = require("@/common/middleware/validate");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.post('/media/upload-url', authenticate_1.authenticate, (0, validate_1.validate)({ body: media_controller_1.uploadUrlSchema }), (0, asyncHandler_1.asyncHandler)(media_controller_1.mediaController.getUploadUrl));
// Dev local upload target
router.put('/media/local-upload/:token', media_controller_1.mediaController.handleLocalUpload);
exports.mediaRoutes = router;
