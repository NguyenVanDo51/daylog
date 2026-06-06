"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUID_RE = void 0;
exports.isValidUUID = isValidUUID;
exports.isValidDate = isValidDate;
exports.UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(s) {
    return exports.UUID_RE.test(s);
}
function isValidDate(s) {
    if (!s)
        return false;
    return !isNaN(new Date(s).getTime());
}
//# sourceMappingURL=validation.js.map