"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zObjectId = void 0;
exports.isValidObjectId = isValidObjectId;
exports.toObjectId = toObjectId;
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
function isValidObjectId(id) {
    return mongoose_1.default.Types.ObjectId.isValid(id);
}
function toObjectId(id) {
    return new mongoose_1.default.Types.ObjectId(id);
}
exports.zObjectId = zod_1.z
    .string()
    .trim()
    .refine((val) => isValidObjectId(val), {
    message: 'Invalid ObjectId',
});
