"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseTransform = caseTransform;
const caseConvert_1 = require("../utils/caseConvert");
function caseTransform(req, res, next) {
    // Apply only for provider role
    if (req.appRole === 'provider') {
        if (req.body && typeof req.body === 'object') {
            req.body = (0, caseConvert_1.deepSnakeToCamel)(req.body);
        }
        if (req.query && typeof req.query === 'object') {
            req.query = (0, caseConvert_1.deepSnakeToCamel)(req.query);
        }
        // Intercept res.json to convert outgoing camelCase payload into snake_case
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            const transformedBody = (0, caseConvert_1.deepCamelToSnake)(body);
            return originalJson(transformedBody);
        };
    }
    next();
}
