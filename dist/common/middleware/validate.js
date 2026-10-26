"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
const caseConvert_1 = require("../utils/caseConvert");
function validate(schemas) {
    return async (req, res, next) => {
        try {
            if (schemas.params) {
                req.params = (await schemas.params.parseAsync(req.params));
            }
            if (schemas.query) {
                req.query = (await schemas.query.parseAsync(req.query));
            }
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';
                const statusCode = isProviderOrAdmin ? 422 : 400;
                const details = error.issues.map((err) => {
                    const fieldPath = err.path.join('.');
                    const field = isProviderOrAdmin ? (0, caseConvert_1.camelToSnakeString)(fieldPath) : fieldPath;
                    return {
                        field,
                        message: err.message,
                    };
                });
                const firstMsg = details.length > 0 ? details[0].message : 'Validation failed';
                const fullMessage = isProviderOrAdmin ? 'The given data failed validation.' : `Validation failed: ${firstMsg}`;
                return next(new AppError_1.AppError(statusCode, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, fullMessage, details));
            }
            next(error);
        }
    };
}
