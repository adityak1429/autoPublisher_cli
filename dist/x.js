"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
(async function main() {
    try {
        const sellerId = core.getInput("seller-id");
        const tenantId = core.getInput("tenant-id");
        const clientId = core.getInput("client-id");
        const clientSecret = core.getInput("client-secret");
        // const fileType = core.getInput("file-type"); // "flight", "msi", or "msix"
        // const filePath = core.getInput("file-path"); // generic file path
        // const flightName = core.getInput("flight-name"); // only for flight
        if (!sellerId || !tenantId || !clientId || !clientSecret) {
            throw new Error("Missing required input(s).");
        }
        let cmd = `msstore reconfigure -s ${sellerId} -t ${tenantId} -c ${clientId} -cs ${clientSecret}`;
        let { stdout, stderr } = await execAsync(cmd);
        if (stdout)
            core.info(stdout);
        if (stderr)
            core.warning(stderr);
        cmd = "msstore apps list";
        ({ stdout, stderr } = await execAsync(cmd));
        if (stdout)
            core.info(stdout);
        if (stderr)
            core.warning(stderr);
    }
    catch (error) {
        core.setFailed((error === null || error === void 0 ? void 0 : error.message) || String(error));
    }
})();
