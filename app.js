import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import { handleStart, handleFreeProxy, handleGiveProxy } from './commands.js';
import { handleCallback } from './callbacks.js';
import dotenv from 'dotenv';

// Завантажуємо змінні середовища з файлу .env
dotenv.config();

// Ініціалізація бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Підключення до бази даних MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err.message));

// Обробник команди /start
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/freeproxy (.+) (.+)/, (msg, match) => {
  handleFreeProxy(bot, msg, match);
});
bot.onText(/\/giveproxy (.+) (\d+)/, (msg, match) => handleGiveProxy(bot, msg, match));

bot.on('message', (msg) => console.log(msg));
// Обробник натискань кнопок
bot.on('callback_query', (callbackQuery) => handleCallback(bot, callbackQuery));
