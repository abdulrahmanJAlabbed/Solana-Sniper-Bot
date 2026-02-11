"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = exports.ConnectionState = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
// Connection states
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["DISCONNECTED"] = "disconnected";
    ConnectionState["CONNECTING"] = "connecting";
    ConnectionState["CONNECTED"] = "connected";
    ConnectionState["RECONNECTING"] = "reconnecting";
    ConnectionState["ERROR"] = "error";
})(ConnectionState || (exports.ConnectionState = ConnectionState = {}));
class WebSocketManager extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.ws = null;
        this.state = ConnectionState.DISCONNECTED;
        this.retryCount = 0;
        this.reconnectTimer = null;
        this.url = options.url;
        this.backoffTime = options.initialBackoff || 1000;
        this.maxBackoff = options.maxBackoff || 30000;
        this.maxRetries = options.maxRetries || Infinity;
        this.debug = options.debug || false;
    }
    // Get current connection state
    getState() {
        return this.state;
    }
    // Connect to WebSocket server
    connect() {
        if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
            this.log("Already connected or connecting");
            return;
        }
        this.setState(ConnectionState.CONNECTING);
        this.log(`Connecting to WebSocket at ${this.url}`);
        try {
            this.ws = new ws_1.default(this.url);
            this.setupEventListeners();
        }
        catch (error) {
            this.handleError(error instanceof Error ? error : new Error("Unknown error during connection"));
        }
    }
    // Send data through the WebSocket
    send(data) {
        if (this.state !== ConnectionState.CONNECTED || !this.ws) {
            this.log("Cannot send: WebSocket not connected", "error");
            return false;
        }
        try {
            const message = typeof data === "string" ? data : JSON.stringify(data);
            this.ws.send(message);
            return true;
        }
        catch (error) {
            this.handleError(error instanceof Error ? error : new Error("Error sending message"));
            return false;
        }
    }
    // Disconnect WebSocket
    disconnect() {
        this.log("Manually disconnecting WebSocket");
        this.cleanUp();
        this.setState(ConnectionState.DISCONNECTED);
    }
    // Set up WebSocket event listeners
    setupEventListeners() {
        if (!this.ws)
            return;
        this.ws.on("open", () => {
            this.setState(ConnectionState.CONNECTED);
            this.retryCount = 0;
            this.backoffTime = 1000; // Reset backoff time on successful connection
            this.emit("open");
            this.log("WebSocket connection established");
        });
        this.ws.on("message", (data) => {
            this.emit("message", data);
        });
        this.ws.on("error", (error) => {
            this.handleError(error);
        });
        this.ws.on("close", (code, reason) => {
            this.log(`WebSocket closed: ${code} - ${reason}`);
            this.cleanUp();
            if (this.state !== ConnectionState.DISCONNECTED) {
                this.attemptReconnect();
            }
        });
    }
    // Handle WebSocket errors
    handleError(error) {
        this.log(`WebSocket error: ${error.message}`, "error");
        this.setState(ConnectionState.ERROR);
        this.emit("error", error);
        // Don't attempt reconnect here - let the close handler do it
        // as an error is typically followed by a close event
    }
    // Attempt to reconnect with exponential backoff
    attemptReconnect() {
        if (this.retryCount >= this.maxRetries) {
            this.log(`Maximum retry attempts (${this.maxRetries}) reached. Giving up.`, "error");
            this.setState(ConnectionState.DISCONNECTED);
            this.emit("max_retries_reached");
            return;
        }
        this.setState(ConnectionState.RECONNECTING);
        this.retryCount++;
        // Calculate backoff with jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
        const delay = Math.min(this.backoffTime * jitter, this.maxBackoff);
        this.log(`Attempting to reconnect in ${Math.round(delay)}ms (attempt ${this.retryCount})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
            // Increase backoff for next attempt
            this.backoffTime = Math.min(this.backoffTime * 1.5, this.maxBackoff);
        }, delay);
    }
    // Clean up resources
    cleanUp() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            // Remove all listeners to prevent memory leaks
            this.ws.removeAllListeners();
            // Close the connection if it's still open
            if (this.ws.readyState === ws_1.default.OPEN || this.ws.readyState === ws_1.default.CONNECTING) {
                try {
                    this.ws.close();
                }
                catch (e) {
                    // Ignore errors during close
                }
            }
            this.ws = null;
        }
    }
    // Update connection state and emit event
    setState(state) {
        if (this.state !== state) {
            this.state = state;
            this.emit("state_change", state);
        }
    }
    // Logging helper
    log(message, level = "info") {
        if (this.debug) {
            if (level === "error") {
                console.error(`[WebSocketManager] ${message}`);
            }
            else {
                console.log(`[WebSocketManager] ${message}`);
            }
        }
    }
}
exports.WebSocketManager = WebSocketManager;
