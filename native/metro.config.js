// Lets the app import the website's shared TypeScript (../shared): types and pure helpers like gettingStarted().
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../shared")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
module.exports = config;
