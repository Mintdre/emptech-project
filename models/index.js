const User = require('./User');
const Post = require('./Post');

// Relationships
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

const { sequelize } = require('../config/database');

module.exports = { User, Post, sequelize };
