import winston from "winston";

const { combine, timestamp, label, printf } = winston.format;

const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level.toUpperCase()}: ${message}`;
});

const options: winston.LoggerOptions = {
    // format: combine(
    //     label({ label: process.env.NODE_ENV }),
    //     timestamp(),
    //     myFormat
    // ),
    transports: [
        new winston.transports.Console({
            level: process.env.NODE_ENV === "production" ? "error" : "debug"
        }),
        new winston.transports.File({ filename: "debug.log", level: "debug" })
    ]
};

const logger = winston.createLogger(options);
logger.info("Logging initialized");

if (process.env.NODE_ENV !== "production") {
    logger.debug("Logging initialized at debug level");
}

export default logger;