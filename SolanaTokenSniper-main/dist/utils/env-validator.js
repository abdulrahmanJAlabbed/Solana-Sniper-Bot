"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const dotenv_1 = require("dotenv");
// Load environment variables
dotenv_1.default.config();
function pickHttpUrl() {
    return process.env.RPC_HTTP_URL || process.env.HELIUS_HTTPS_URI;
}
function pickWsUrl() {
    return process.env.RPC_WS_URL || process.env.HELIUS_WSS_URI;
}
function validateUrl(value, protocol) {
    if (!value)
        return;
    let url;
    try {
        url = new URL(value);
    }
    catch (error) {
        throw new Error(`🚫 Invalid URL: ${value}`);
    }
    if (url.protocol !== protocol) {
        throw new Error(`🚫 URL must start with ${protocol}: ${value}`);
    }
    const needsApiKey = value.includes("helius");
    if (needsApiKey) {
        const apiKey = url.searchParams.get("api-key");
        if (!apiKey || apiKey.trim() === "") {
            throw new Error(`🚫 The 'api-key' parameter is missing or empty in the URL: ${value}`);
        }
    }
}
function validateEnv() {
    const httpsUrl = pickHttpUrl();
    const wssUrl = pickWsUrl();
    const missing = [];
    if (!httpsUrl)
        missing.push("RPC_HTTP_URL or HELIUS_HTTPS_URI");
    if (!wssUrl)
        missing.push("RPC_WS_URL or HELIUS_WSS_URI");
    if (missing.length > 0) {
        throw new Error(`🚫 Missing required environment variables: ${missing.join(", ")}`);
    }
    validateUrl(httpsUrl, "https:");
    validateUrl(wssUrl, "wss:");
    return {
        HELIUS_HTTPS_URI: httpsUrl,
        HELIUS_WSS_URI: wssUrl,
        SNIPEROO_API_KEY: process.env.SNIPEROO_API_KEY,
        SNIPEROO_PUBKEY: process.env.SNIPEROO_PUBKEY,
    };
}
