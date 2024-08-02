import UserModel from '../db/models/UserModel.js';
import TransactionModel from '../db/models/TransactionModel.js';
import PriceModel from '../db/models/PriceModel.js';

import Decimal from 'decimal.js';

import mongoose from 'mongoose';

import checkAuth from '../db/middleware/checkAuth.js';
import { createTransaction, getTransactionsByTelegramId } from '../createTransaction.js';

import { formatter } from '../callbacks.js';
import { formatAmount } from '../bot/utils/formatters.js';

export const handleMyBalance = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const result = await checkAuth(telegramId, ['admin', 'user']);
    if (result.permission) {
      const user = result.user;

      if (!user) {
        bot.sendMessage(chatId, 'Пользователь не найден.');
        return;
      }

      const transactions = await TransactionModel.find({ telegramId });
      await getTransactionsByTelegramId(transactions);

      let message = `<b>Ваш баланс:</b> ${user.balance}$\n\n`;
      if (transactions.length > 0) {
        message += `<b>История транзакций:</b>\n\n`;
        transactions.forEach((transaction, index) => {
          const date = formatter.format(new Date(transaction.createdAt));
          message += `<b><a href="${transaction.pageUrl}">Транзакция №${index + 1} | ${
            transaction.invoiceId
          }</a></b>\nСумма: ${formatAmount(transaction.amount)}; Статус: ${
            transaction.status
          }; ${date}\n\n`;
        });
      } else {
        message += 'У вас пока нет транзакций.\n';
      }

      message += `\nПоследнее обновление: ${formatter.format(new Date())}`;

      // Добавляем кнопку "Пополнить баланс"
      const keyboard = {
        inline_keyboard: [
          [
            { text: '💳 Пополнить баланс', callback_data: 'topup_balance' },
            { text: '🔄 Обновить', callback_data: 'my_balance' },
          ],
          [{ text: '🔙 Назад', callback_data: 'login_or_register' }],
        ],
      };

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      bot.editMessageText('У вас нет прав на это действие.', {
        chat_id: chatId,
        message_id: messageId,
      });
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
};

const waitingForTopupAmount = new Set();
const topupInputHandlers = {};

// Обработчик команды /topup
export const handleTopupBalance = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  waitingForTopupAmount.delete(chatId);
  if (topupInputHandlers[chatId]) {
    bot.removeListener('message', topupInputHandlers[chatId]);
    delete topupInputHandlers[chatId];
  }

  try {
    const result = await checkAuth(telegramId, ['admin', 'user']);
    if (result.permission) {
      const prices = await PriceModel.find({}).sort({ currency: 1 });
      const buttons = prices.map((price) => ({
        text: `${price.amount}$`,
        callback_data: `topup_${price.description}`,
      }));

      // Создаем клавиатуру
      const keyboard = {
        inline_keyboard: [
          buttons, // Все кнопки с заготовленными суммами в одном ряду
          [{ text: '💸 Кастомная сумма', callback_data: 'topup_custom' }], // Кнопка кастомного пополнения на новой строке
          [{ text: '🔙 Назад', callback_data: 'my_balance' }], // Кнопка "Назад" на новой строке
        ],
      };

      bot.editMessageText(
        'Выберите сумму для пополнения баланса:\n\nДля пополнения баланса криптовалютой - напишите в тех.поддержку.',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        },
      );
    } else {
      bot.editMessageText('У вас нет прав на это действие.', {
        chat_id: chatId,
        message_id: messageId,
      });
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
};

export const handleTopupBalanceGeneric = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;
  const action = callbackQuery.data.split('_')[1]; // Получаем описание из callback_data

  try {
    const user = await UserModel.findOne({ telegramId });

    if (!user) {
      bot.editMessageText('Пользователь не найден.', {
        chat_id: chatId,
        message_id: messageId,
      });
      return;
    }

    const price = await PriceModel.findOne({ description: action });

    if (!price) {
      bot.editMessageText('Неверная сумма для пополнения.', {
        chat_id: chatId,
        message_id: messageId,
      });
      return;
    }

    const transaction = await createTransaction(
      user._id,
      user.telegramId,
      price.amount * 100,
      price.currency,
      120,
      'Пополнение счета SimpleProxy',
      `Пополнение баланса на ${price.amount}$`,
    );

    bot.editMessageText(
      `<b>Платеж успешно создан!</b>\nПожалуйста, <b><a href="${transaction.pageUrl}">оплатите ${price.amount}$.</a></b> в течении <b>${transaction.validity}</b> секунд.\nПосле оплаты, перейдите на страницу <b>"Мой баланс"</b> и обновите свои транзакции.`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '💰 Мой баланс', callback_data: 'my_balance' }]],
        },
      },
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.editMessageText('Произошла ошибка. Попробуйте позже.', {
      chat_id: chatId,
      message_id: messageId,
    });
  }
};

export async function handleTopupCustom(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;

  try {
    const user = await UserModel.findOne({ telegramId });

    if (user) {
      // Устанавливаем состояние ожидания кастомной суммы
      waitingForTopupAmount.add(chatId);

      // Отправляем сообщение для ввода кастомной суммы
      const message = '<b>Введите сумму для пополнения (до 1 знака после запятой):</b>';
      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'topup_balance' }]],
        },
      };

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...options,
      });

      // Функция для обработки ввода кастомной суммы
      const handleTopupAmountInput = async (msg) => {
        if (waitingForTopupAmount.has(chatId) && msg.chat.id === chatId && msg.text) {
          const amountStr = msg.text.trim();

          // Проверяем корректность ввода суммы
          if (isNaN(amountStr) || amountStr <= 0 || !/^(\d+(\.\d{1})?)$/.test(amountStr)) {
            return bot.sendMessage(
              chatId,
              'Неверный формат суммы. Используйте формат X.0 или X.X, где X - цифры.',
            );
          }

          const amount = new Decimal(amountStr);
          if (amount.lte(0)) {
            return bot.sendMessage(
              chatId,
              'Неверная сумма. Убедитесь, что сумма является положительным числом.',
            );
          }

          // Получаем валюту, предполагаем, что это 840 (USD)
          const currency = 840;

          // Создаем транзакцию
          const transaction = await createTransaction(
            user._id,
            user.telegramId,
            amount.mul(100).toNumber(), // Сумма пополнения в копейках
            currency,
            120,
            'Пополнение счета SimpleProxy',
            `Пополнение баланса на ${amount.toFixed(1)}$`,
          );

          // Обновляем сообщение о создании платежа
          await bot.editMessageText(
            `<b>Платеж успешно создан!</b>\nПожалуйста, <b><a href="${
              transaction.pageUrl
            }">оплатите ${amount.toFixed(1)}$</a></b> в течение <b>${
              transaction.validity
            }</b> секунд.\nПосле оплаты, перейдите на страницу <b>"Мой баланс"</b> и обновите свои транзакции.`,
            {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '💰 Мой баланс', callback_data: 'my_balance' }]],
              },
            },
          );

          waitingForTopupAmount.delete(chatId); // Удаляем состояние ожидания
          bot.removeListener('message', handleTopupAmountInput); // Удаляем обработчик после успешного ввода
          delete topupInputHandlers[chatId];
        }
      };

      // Устанавливаем обработчик ввода кастомной суммы
      topupInputHandlers[chatId] = handleTopupAmountInput;
      bot.on('message', handleTopupAmountInput);
    } else {
      bot.sendMessage(chatId, 'Пользователь не найден.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}
