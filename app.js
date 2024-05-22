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
} from './commands.js';
import { handleCallback } from './callbacks.js';
import dotenv from 'dotenv';

// Завантажуємо змінні середовища з файлу .env
dotenv.config();

// Ініціалізація бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Підключення до бази даних MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB ++'))
  .catch((err) => console.error('Error connecting to MongoDB:', err.message));

// Обробник команди /start
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
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
bot.onText(/\/allusers (.+)/, async (msg, match) => {
  handleAllUsers(bot, msg, match);
});
bot.onText(/\/notifyusers/, async (msg) => notifyUsers(bot, msg));

bot.onText(/\/updateproxypass (\S+) (\S+) (\S+)/, (msg, match) =>
  handleUpdateProxyPass(bot, msg, match),
);

bot.on('callback_query', (callbackQuery) => handleCallback(bot, callbackQuery));
