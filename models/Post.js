const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
    slug: { type: DataTypes.STRING, unique: true, allowNull: false },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    rawContent: { type: DataTypes.TEXT, allowNull: true }, // Stores original Markdown
    title: { type: DataTypes.STRING, allowNull: false }
});

module.exports = Post;
