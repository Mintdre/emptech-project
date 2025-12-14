const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },

    // SaaS Logic
    tier: { type: DataTypes.STRING, defaultValue: 'Free' }, // Options: Free, Premium, Plus
    generationCount: { type: DataTypes.INTEGER, defaultValue: 0 }, // How many blogs generated this month
    lastResetDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } // When the month started for this user
});

module.exports = User;
