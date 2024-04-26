import UserModel from '../db/models/UserModel.js';
import TransactionModel from '../db/models/TransactionModel.js';

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

export const handleTopupBalance = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const result = await checkAuth(telegramId, ['admin', 'user']);
    if (result.permission) {
      const keyboard = {
        inline_keyboard: [
          [
            { text: '1$', callback_data: 'topup_1' },
            { text: '8$', callback_data: 'topup_8' },
            { text: '25$', callback_data: 'topup_25' },
          ],
          [{ text: '🔙 Назад', callback_data: 'my_balance' }],
        ],
      };

      bot.editMessageText('Выберите сумму для пополнения баланса:', {
        chat_id: chatId,
        message_id: messageId,
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

export const handleTopupBalance8 = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Находим пользователя по telegramId
    const user = await UserModel.findOne({ telegramId });

    if (!user) {
      bot.editMessageText('Пользователь не найден.', {
        chat_id: chatId,
        message_id: messageId,
      });
      return;
    }

    // Создаем транзакцию для пополнения баланса на 8$
    const transaction = await createTransaction(
      user._id, // Идентификатор пользователя в базе данных
      user.telegramId, //Телеграм айди юзера
      800, // Сумма пополнения в копейках (8$ = 800 копеек)
      840, // Код валюты (980 - гривна)
      120, //Время в секудах дейстия
      'Пополнение счета SimpleProxy', // Номер чека или описание платежа
      'Пополнение баланса на 8$', // Призначение платежа
    );

    // Отправляем сообщение пользователю о создании платежа
    bot.editMessageText(
      `<b>Платеж успешно создан!</b>\nПожалуйста, <b><a href="${transaction.pageUrl}">оплатите 8$.</a></b> в течении <b>${transaction.validity}</b> секунд.\nПосле оплаты, перейдите на страницу <b>"Мой баланс"</b> и обновите свои транзакции.`,
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

export const handleTopupBalance1 = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Находим пользователя по telegramId
    const user = await UserModel.findOne({ telegramId });

    if (!user) {
      bot.editMessageText('Пользователь не найден.', {
        chat_id: chatId,
        message_id: messageId,
      });
      return;
    }

    // Создаем транзакцию для пополнения баланса на 8$
    const transaction = await createTransaction(
      user._id, // Идентификатор пользователя в базе данных
      user.telegramId, //Телеграм айди юзера
      100, // Сумма пополнения в копейках (8$ = 800 копеек)
      840, // Код валюты (980 - гривна)
      120, //Время в секудах дейстия
      'Пополнение счета SimpleProxy', // Номер чека или описание платежа
      'Пополнение баланса на 1$', // Призначение платежа
    );

    // Отправляем сообщение пользователю о создании платежа
    bot.editMessageText(
      `<b>Платеж успешно создан!</b>\nПожалуйста, <b><a href="${transaction.pageUrl}">оплатите 1$.</a></b> в течении <b>${transaction.validity}</b> секунд.\nПосле оплаты, перейдите на страницу <b>"Мой баланс"</b> и обновите свои транзакции.`,
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

export const handleTopupBalance25 = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Находим пользователя по telegramId
    const user = await UserModel.findOne({ telegramId });

    if (!user) {
      bot.editMessageText('Пользователь не найден.', {
        chat_id: chatId,
        message_id: messageId,
      });
      return;
    }

    // Создаем транзакцию для пополнения баланса на 8$
    const transaction = await createTransaction(
      user._id, // Идентификатор пользователя в базе данных
      user.telegramId, //Телеграм айди юзера
      2500, // Сумма пополнения в копейках (8$ = 800 копеек)
      840, // Код валюты (980 - гривна)
      120, //Время в секудах дейстия
      'Пополнение счета SimpleProxy', // Номер чека или описание платежа
      'Пополнение баланса на 25$', // Призначение платежа
    );

    // Отправляем сообщение пользователю о создании платежа
    bot.editMessageText(
      `<b>Платеж успешно создан!</b>\nПожалуйста, <b><a href="${transaction.pageUrl}">оплатите 25$.</a></b> в течении <b>${transaction.validity}</b> секунд.\nПосле оплаты, перейдите на страницу <b>"Мой баланс"</b> и обновите свои транзакции.`,
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
