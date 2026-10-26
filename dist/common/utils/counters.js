"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextCode = nextCode;
const Counter_1 = require("@/models/Counter");
const PREFIX_MAP = {
    enquiry: 'ENQ',
    booking: 'BKG',
    receipt: 'REC',
    invoice: 'INV',
    ticket: 'TKT',
};
async function nextCode(key, session) {
    const result = await Counter_1.Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
    const prefix = PREFIX_MAP[key];
    const number = 100000 + result.seq;
    return `${prefix}-${number}`;
}
