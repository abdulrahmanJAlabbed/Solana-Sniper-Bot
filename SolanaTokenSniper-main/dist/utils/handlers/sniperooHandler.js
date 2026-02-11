"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyToken = buyToken;
const axios_1 = __importDefault(require("axios"));
const env_validator_1 = require("../env-validator");
/**
 * Buys a token using the Sniperoo API
 * @param tokenAddress The token's mint address
 * @param inputAmount Amount of SOL to spend
 * @returns Boolean indicating if the purchase was successful
 */
async function buyToken(tokenAddress, inputAmount, sell, tp, sl) {
    try {
        const env = (0, env_validator_1.validateEnv)();
        // Validate inputs
        if (!tokenAddress || typeof tokenAddress !== "string" || tokenAddress.trim() === "") {
            return false;
        }
        if (inputAmount <= 0) {
            return false;
        }
        if (!tp || !sl) {
            sell = false;
        }
        // Prepare request body
        const requestBody = {
            walletAddresses: [env.SNIPEROO_PUBKEY],
            tokenAddress: tokenAddress,
            inputAmount: inputAmount,
            autoSell: {
                enabled: sell,
                strategy: {
                    strategyName: "simple",
                    profitPercentage: tp,
                    stopLossPercentage: sl,
                },
            },
        };
        // Make API request using axios
        const response = await axios_1.default.post("https://api.sniperoo.app/trading/buy-token?toastFrontendId=0", requestBody, {
            headers: {
                Authorization: `Bearer ${env.SNIPEROO_API_KEY}`,
                "Content-Type": "application/json",
            },
        });
        // Axios automatically throws an error for non-2xx responses,
        // so if we get here, the request was successful
        return true;
    }
    catch (error) {
        // Handle axios errors
        if (axios_1.default.isAxiosError(error)) {
            console.error(`Sniperoo API error (${error.response?.status || "unknown"}):`, error.response?.data || error.message);
        }
        else {
            console.error("Error buying token:", error instanceof Error ? error.message : "Unknown error");
        }
        return false;
    }
}
