"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptDocumentNumber = exports.encryptDocumentNumber = void 0;
exports.encryptDoc = encryptDoc;
exports.decryptDoc = decryptDoc;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("@/config/env");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
function getKey() {
    const buf = Buffer.from(env_1.env.DOC_ENCRYPTION_KEY, 'base64');
    if (buf.length !== 32) {
        throw new Error('DOC_ENCRYPTION_KEY must be a 32-byte base64 encoded string');
    }
    return buf;
}
function encryptDoc(plainText) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
function decryptDoc(encryptedPayload) {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted document format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
exports.encryptDocumentNumber = encryptDoc;
exports.decryptDocumentNumber = decryptDoc;
