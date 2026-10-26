"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayjs = void 0;
exports.nowIST = nowIST;
exports.todayIST = todayIST;
exports.ymd = ymd;
exports.eachDay = eachDay;
exports.relativeTime = relativeTime;
exports.formatDisplayDate = formatDisplayDate;
exports.formatMonthYear = formatMonthYear;
exports.formatDateRange = formatDateRange;
exports.parseTolerantDate = parseTolerantDate;
const dayjs_1 = __importDefault(require("dayjs"));
exports.dayjs = dayjs_1.default;
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const relativeTime_1 = __importDefault(require("dayjs/plugin/relativeTime"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
const constants_1 = require("@/config/constants");
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
dayjs_1.default.extend(relativeTime_1.default);
dayjs_1.default.extend(customParseFormat_1.default);
function nowIST() {
    return (0, dayjs_1.default)().tz(constants_1.TIMEZONE_IST);
}
function todayIST() {
    return nowIST().format('YYYY-MM-DD');
}
function ymd(date) {
    return (0, dayjs_1.default)(date).tz(constants_1.TIMEZONE_IST).format('YYYY-MM-DD');
}
function eachDay(startDate, endDate) {
    const days = [];
    let current = dayjs_1.default.tz(startDate, constants_1.TIMEZONE_IST);
    const end = dayjs_1.default.tz(endDate, constants_1.TIMEZONE_IST);
    while (current.isBefore(end) || current.isSame(end, 'day')) {
        days.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
    }
    return days;
}
function relativeTime(date) {
    return (0, dayjs_1.default)(date).from(nowIST());
}
function formatDisplayDate(date) {
    return (0, dayjs_1.default)(date).tz(constants_1.TIMEZONE_IST).format('D MMM YYYY');
}
function formatMonthYear(date) {
    return (0, dayjs_1.default)(date).tz(constants_1.TIMEZONE_IST).format('MMM YYYY');
}
function formatDateRange(startDate, endDate) {
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
}
function parseTolerantDate(input) {
    if (!input)
        return null;
    if (input instanceof Date)
        return isNaN(input.getTime()) ? null : input;
    const trimmed = input.replace(/^Valid till /i, '').trim();
    const formats = [
        'YYYY-MM-DD',
        'YYYY-MM-DDTHH:mm:ss.SSSZ',
        'YYYY-MM-DDTHH:mm:ssZ',
        'D MMM YYYY',
        'DD MMM YYYY',
        'D MMMM YYYY',
        'DD/MM/YYYY',
        'YYYY/MM/DD',
    ];
    for (const fmt of formats) {
        const parsed = dayjs_1.default.tz(trimmed, fmt, constants_1.TIMEZONE_IST);
        if (parsed.isValid()) {
            return parsed.endOf('day').toDate();
        }
    }
    const standard = (0, dayjs_1.default)(trimmed);
    if (standard.isValid()) {
        return standard.endOf('day').toDate();
    }
    return null;
}
