"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCheckManager = void 0;
exports.getTokenAuthorities = getTokenAuthorities;
exports.isTokenSecure = isTokenSecure;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const config_1 = require("../../config");
const env_validator_1 = require("../env-validator");
const DEFAULT_RETRY_ATTEMPTS = 6;
const DEFAULT_RETRY_DELAY_MS = 1500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function parseRpcUrlList(env) {
    const urls = new Set();
    if (env?.HELIUS_HTTPS_URI)
        urls.add(env.HELIUS_HTTPS_URI);
    if (process.env.RPC_HTTP_URL)
        urls.add(process.env.RPC_HTTP_URL);
    if (process.env.RPC_HTTP_URLS) {
        process.env.RPC_HTTP_URLS.split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach((item) => urls.add(item));
    }
    return Array.from(urls);
}
function isTransientError(error) {
    const message = String(error?.message || error || "");
    return (message.includes("429") ||
        message.includes("rate limited") ||
        message.includes("Failed to fetch") ||
        message.includes("network request failed") ||
        message.includes("not a Token mint") ||
        message.includes("Invalid param") ||
        message.includes("Account does not exist"));
}
async function withRetry(fn, attempts, delayMs) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (!isTransientError(error) || attempt >= attempts) {
                break;
            }
            const backoff = delayMs * Math.pow(1.6, attempt - 1);
            await sleep(backoff);
            console.log(`Retry attempt ${attempt + 1} for getMint after ${Math.round(backoff)}ms delay`);
        }
    }
    throw lastError;
}
/**
 * TokenCheckManager class for verifying token security properties
 */
class TokenCheckManager {
    constructor(connection) {
        const env = (0, env_validator_1.validateEnv)();
        this.rpcUrls = parseRpcUrlList(env);
        this.rpcIndex = 0;
        this.connections = new Map();
        this.connection = connection || this.getConnection();
    }
    getConnection() {
        if (this.connection)
            return this.connection;
        if (!this.rpcUrls.length) {
            throw new Error("No RPC HTTP URLs available for token checks");
        }
        const url = this.rpcUrls[this.rpcIndex % this.rpcUrls.length];
        this.rpcIndex += 1;
        if (!this.connections.has(url)) {
            this.connections.set(url, new web3_js_1.Connection(url, "confirmed"));
        }
        return this.connections.get(url);
    }
    /**
     * Check if a token's mint and freeze authorities are still enabled
     * @param mintAddress The token's mint address (contract address)
     * @returns Object containing authority status and details
     */
    async getTokenAuthorities(mintAddress) {
        try {
            // Validate mint address
            if (!mintAddress || typeof mintAddress !== "string" || mintAddress.trim() === "") {
                throw new Error("Invalid mint address");
            }
            let mintPublicKey;
            try {
                mintPublicKey = new web3_js_1.PublicKey(mintAddress);
            }
            catch (error) {
                throw new Error(`Invalid mint address format: ${error.message}`);
            }
            const delayMs = Number(process.env.MINT_FETCH_DELAY_MS || "1200");
            if (delayMs > 0) {
                await sleep(delayMs);
            }
            let mintInfo;
            try {
                mintInfo = await withRetry(() => (0, spl_token_1.getMint)(this.getConnection(), mintPublicKey), DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY_MS);
            }
            catch (error) {
                if (isTransientError(error)) {
                    console.log(`Mint info not ready for ${mintAddress}, skipping for now.`);
                    return null;
                }
                throw new Error(`Failed to fetch mint info: ${error.message}`);
            }
            // Check if mint authority exists (is not null)
            const hasMintAuthority = mintInfo.mintAuthority !== null;
            // Check if freeze authority exists (is not null)
            const hasFreezeAuthority = mintInfo.freezeAuthority !== null;
            // Get the addresses as strings if they exist
            const mintAuthorityAddress = mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null;
            const freezeAuthorityAddress = mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null;
            return {
                mintAddress: mintAddress,
                hasMintAuthority,
                hasFreezeAuthority,
                mintAuthorityAddress,
                freezeAuthorityAddress,
                isSecure: !hasMintAuthority && !hasFreezeAuthority,
                details: {
                    supply: mintInfo.supply.toString(),
                    decimals: mintInfo.decimals,
                },
            };
        }
        catch (error) {
            console.error(`Error checking token authorities for ${mintAddress}:`, error);
            throw error;
        }
    }
    /**
     * Simplified check that returns only whether the token passes security checks
     * based on the configuration settings
     * @param mintAddress The token's mint address
     * @returns Boolean indicating if the token passes security checks
     */
    async isTokenSecure(mintAddress) {
        try {
            const authorityStatus = await this.getTokenAuthorities(mintAddress);
            if (!authorityStatus)
                return false;
            // Check against configuration settings
            const allowMintAuthority = config_1.config.checks.settings.allow_mint_authority;
            const allowFreezeAuthority = config_1.config.checks.settings.allow_freeze_authority;
            // Token is secure if:
            // 1. It has no mint authority OR mint authority is allowed in config
            // 2. It has no freeze authority OR freeze authority is allowed in config
            return ((!authorityStatus.hasMintAuthority || allowMintAuthority) &&
                (!authorityStatus.hasFreezeAuthority || allowFreezeAuthority));
        }
        catch (error) {
            console.error(`Error checking if token is secure: ${mintAddress}`, error);
            return false; // Consider token insecure if there's an error
        }
    }
}
exports.TokenCheckManager = TokenCheckManager;
// Create a singleton instance for better performance
const tokenCheckManager = new TokenCheckManager();
/**
 * Check if a token's mint and freeze authorities are still enabled
 * @param mintAddress The token's mint address
 * @returns Object containing authority status and details
 */
async function getTokenAuthorities(mintAddress) {
    return tokenCheckManager.getTokenAuthorities(mintAddress);
}
/**
 * Check if a token passes security checks based on configuration
 * @param mintAddress The token's mint address
 * @returns Boolean indicating if the token passes security checks
 */
async function isTokenSecure(mintAddress) {
    return tokenCheckManager.isTokenSecure(mintAddress);
}
