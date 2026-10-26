"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDigitPrefixedKey = isDigitPrefixedKey;
exports.camelToSnakeString = camelToSnakeString;
exports.snakeToCamelString = snakeToCamelString;
exports.deepCamelToSnake = deepCamelToSnake;
exports.deepSnakeToCamel = deepSnakeToCamel;
function isDigitPrefixedKey(key) {
    return /^[0-9]+_[a-zA-Z0-9_]+$/.test(key);
}
function camelToSnakeString(str) {
    if (isDigitPrefixedKey(str)) {
        return str;
    }
    return str.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, '');
}
function snakeToCamelString(str) {
    if (isDigitPrefixedKey(str)) {
        return str;
    }
    return str.replace(/_([a-z0-9])/g, (_, p1) => p1.toUpperCase());
}
function deepCamelToSnake(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (obj instanceof Date || obj instanceof RegExp) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => deepCamelToSnake(item));
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const newKey = camelToSnakeString(key);
            result[newKey] = deepCamelToSnake(value);
        }
        return result;
    }
    return obj;
}
function deepSnakeToCamel(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (obj instanceof Date || obj instanceof RegExp) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => deepSnakeToCamel(item));
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const newKey = snakeToCamelString(key);
            result[newKey] = deepSnakeToCamel(value);
        }
        return result;
    }
    return obj;
}
