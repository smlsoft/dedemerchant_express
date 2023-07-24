
const winston = require('winston');
const expressWinston = require('express-winston');

const enumerateErrorFormat = winston.format((info) => {
    if (info instanceof Error) {
        Object.assign(info, { message: info.stack });
    }
    return info;
});
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        //   enumerateErrorFormat(),
        winston.format.uncolorize(),
        winston.format.json(),
        //   winston.format.splat(),
        //   winston.format.printf(({ level, message }) => `${level}: ${message}`)
    ),

    transports: [
        new winston.transports.Console({
            stderrLevels: ['error'],
        }),
        new winston.transports.File({ filename: './log/error.log', level: 'error' }),
        new winston.transports.File({ filename: './log/log.log', level: 'info' }),
    ],
});

  function info(message, ...args) {
    logger.info(message, ...args);
}

const debug = (message, ...args) => {
    logger.debug(message, ...args);
}

// Log an error message
function error(message) {
    logger.error(message);
}

module.exports = {
    info,
    debug,
    error
};