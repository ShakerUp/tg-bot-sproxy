import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';

import {
  handleStart,
  handleFreeProxy,
  handleGiveProxy,
  addProxy,
  allNoProxy,
  handleAllUsers,
  notifyUsers,
  handleUpdateProxyPass,
  allWithProxy,
  handleUpdateProxyDuration,
  handleUpdateProxyPrice,
  handleUpdateUserBalance,
  handleBroadcast,
} from './commands.js';
import { handleCallback } from './callbacks.js';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

await mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB ++'))
  .catch((err) => console.error('Error connecting to MongoDB:', err.message));

bot.onText(/\/start(.*)/, (msg, match) => handleStart(bot, msg, match[1]));
bot.onText(/\/freeproxy (\S+) (\S+) (\S+)/, (msg, match) => {
  handleFreeProxy(bot, msg, match);
});

bot.onText(/\/giveproxy (\S+) (\d+) (\d+(\.\d+)?)/, (msg, match) => {
  handleGiveProxy(bot, msg, match);
});

bot.onText(/\/addproxy (.+)/, (msg, match) => {
  addProxy(bot, msg);
});

bot.onText(/\/allnoproxy (.+)/, (msg, match) => {
  allNoProxy(bot, msg, match);
});
bot.onText(/\/allproxy (.+)/, (msg, match) => {
  allWithProxy(bot, msg, match);
});
bot.onText(/\/allusers (.+)/, async (msg, match) => {
  handleAllUsers(bot, msg, match);
});
bot.onText(/\/notifyusers/, async (msg) => notifyUsers(bot, msg));

bot.onText(/\/updateproxypass (\S+) (\S+) (\S+)/, (msg, match) =>
  handleUpdateProxyPass(bot, msg, match),
);
bot.onText(/\/updateproxyduration (\S+) ([+-]\d+(\.\d+)?)/, (msg, match) =>
  handleUpdateProxyDuration(bot, msg, match),
);
bot.onText(/\/updateproxyprice (.+)/, (msg, match) => {
  handleUpdateProxyPrice(bot, msg);
});

bot.onText(/\/updateuserbalance (.+)/, (msg, match) => {
  handleUpdateUserBalance(bot, msg);
});
bot.onText(/\/updateuserbonus (.+)/, (msg, match) => {
  handleUpdateUserBalance(bot, msg, 'ref');
});
bot.onText(/\/broadcast/, (msg) => handleBroadcast(bot, msg));

bot.on('callback_query', (callbackQuery) => handleCallback(bot, callbackQuery));