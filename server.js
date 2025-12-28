require('dotenv').config();
const { app, logger } = require('./app');

const PORT = process.env.PORT || 6769;

// --- SERVER START ---
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`------------------------------------------------`);
        logger.info(`🏰 ORACLE OS ONLINE: http://localhost:${PORT}`);
        logger.info(`💾 DATABASE: PostgreSQL + Redis`);
        logger.info(`------------------------------------------------`);
    });
}

module.exports = app;

