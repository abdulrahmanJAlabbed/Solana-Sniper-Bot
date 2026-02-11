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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTableNewTokens = createTableNewTokens;
exports.insertNewToken = insertNewToken;
exports.selectTokenByNameAndCreator = selectTokenByNameAndCreator;
exports.selectTokenByMint = selectTokenByMint;
exports.selectAllTokens = selectAllTokens;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sqlite3 = __importStar(require("sqlite3"));
const sqlite_1 = require("sqlite");
const config_1 = require("./../config");
const ROOT_DIR = path.resolve(__dirname, "..", "..");
function resolveDbPath() {
    const configured = config_1.config.db.pathname || "tracker/tokens.db";
    if (path.isAbsolute(configured))
        return configured;
    return path.resolve(ROOT_DIR, configured);
}
async function getDatabase() {
    const filename = resolveDbPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    return (0, sqlite_1.open)({
        filename,
        driver: sqlite3.Database,
    });
}
// New token duplicates tracker
async function createTableNewTokens(database) {
    try {
        await database.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time INTEGER NOT NULL,
      name TEXT NOT NULL,
      mint TEXT NOT NULL,
      creator TEXT NOT NULL
    );
  `);
        return true;
    }
    catch (error) {
        return false;
    }
}
async function insertNewToken(newToken) {
    const db = await getDatabase();
    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
        await db.close();
    }
    // Proceed with adding holding
    if (newTokensTableExist) {
        const { time, name, mint, creator } = newToken;
        await db.run(`
    INSERT INTO tokens (time, name, mint, creator)
    VALUES (?, ?, ?, ?);
  `, [time, name, mint, creator]);
        await db.close();
    }
}
async function selectTokenByNameAndCreator(name, creator) {
    // Open the database
    const db = await getDatabase();
    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
        await db.close();
        return [];
    }
    // Query the database for matching tokens
    const tokens = await db.all(`
    SELECT * 
    FROM tokens
    WHERE name = ? OR creator = ?;
  `, [name, creator]);
    // Close the database
    await db.close();
    // Return the results
    return tokens;
}
async function selectTokenByMint(mint) {
    // Open the database
    const db = await getDatabase();
    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
        await db.close();
        return [];
    }
    // Query the database for matching tokens
    const tokens = await db.all(`
    SELECT * 
    FROM tokens
    WHERE mint = ?;
  `, [mint]);
    // Close the database
    await db.close();
    // Return the results
    return tokens;
}
async function selectAllTokens() {
    // Open the database
    const db = await getDatabase();
    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
        await db.close();
        return [];
    }
    // Query the database for matching tokens
    const tokens = await db.all(`
    SELECT * 
    FROM tokens;
  `);
    // Close the database
    await db.close();
    // Return the results
    return tokens;
}
