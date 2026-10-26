"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatINR = formatINR;
function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}
