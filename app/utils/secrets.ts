import logger from "./logger";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env")) {
    logger.debug("Using .env file to supply config environment variables");
    dotenv.config({ path: ".env" });
} 

export const ENVIRONMENT = process.env.NODE_ENV;
const prod = ENVIRONMENT === "production"; // Anything else is treated as 'dev'

export const SESSION_SECRET = process.env["SESSION_SECRET"];
export const MONGODB_URI = prod ? process.env["MONGODB_URI"] : process.env["MONGODB_URI_LOCAL"];
export const TELEGRAM_API_KEY = process.env["TELEGRAM_API_KEY"];
export const SPOTIFY_CLIENT_ID = process.env["SPOTIFY_CLIENT_ID"];
export const SPOTIFY_SECRET = process.env["SPOTIFY_SECRET"];
export const SPOTIFY_REFRESH_TOKEN = process.env["SPOTIFY_REFRESH_TOKEN"];

if (!TELEGRAM_API_KEY) {
    if (prod) {
        logger.error("Set TELEGRAM_API_KEY environment variable.");
    } else {
        logger.error("No mongo connection string. Set MONGODB_URI_LOCAL environment variable.");
    }
    process.exit(1);
}
