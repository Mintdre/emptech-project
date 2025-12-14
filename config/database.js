const { Sequelize } = require('sequelize');
const winston = require('winston');

// Setup simple logger for DB connection
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

const sequelize = new Sequelize(process.env.POSTGRES_URI, {
    logging: false,
    dialectOptions: { ssl: false }
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        logger.info('🔮 Database Connected (PostgreSQL)');
        await sequelize.sync({ alter: true });
    } catch (err) {
        logger.error(`❌ DB ERROR: ${err.message}`);
    }
};

module.exports = { sequelize, connectDB };
