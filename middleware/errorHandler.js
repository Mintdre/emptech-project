const winston = require('winston');

// Logger specifically for errors (could reuse existing logger)
const logger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log' })
    ]
});

function errorHandler(err, req, res, next) {
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const statusCode = err.statusCode || 500;
    const message = err.statusMessage || 'Internal Server Error';

    // Return JSON for API requests, HTML for browser
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(statusCode).json({ error: message, details: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }

    if (process.env.NODE_ENV === 'development') {
        // In dev, show stack trace on page if possible or just plain text
        return res.status(statusCode).send(`<h1>${message}</h1><pre>${err.stack}</pre>`);
    }

    res.status(statusCode).render('index', {
        currentPost: null,
        upgraded: null,
        error: "Something went wrong. Please try again later."
    });
}

module.exports = errorHandler;
