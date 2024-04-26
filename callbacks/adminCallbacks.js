import checkAuth from '../db/middleware/checkAuth.js';
import UserModel from '../db/models/UserModel.js';
import ProxyModel from '../db/models/ProxyModel.js';
import BalanceTopUpModel from '../db/models/BalanceTopUpModel.js';

import { formatter } from '../callbacks.js';
import { formatAmount } from '../bot/utils/formatters.js';

export async function handleAdminPanel(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (result.permission) {
      const declineMessage = 'Админ панель:';
      const declineOptions = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Пользователи', callback_data: 'admin_users' },
              { text: 'Прокси', callback_data: 'admin_proxies' },
              { text: 'Пополнение баланса', callback_data: 'admin_balance_top_ups' },
            ],
            [{ text: '🔙 Назад', callback_data: 'login_or_register' }],
          ],
        },
      };
      bot.editMessageText(declineMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...declineOptions,
      });
    }

    if (!result) {
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleAdminUsers(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramId = callbackQuery.from.id;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (result.permission) {
      const userProxies = await UserModel.find();

      let message = '';

      if (userProxies.length > 0) {
        message += '<b>Все пользователи:</b>\n\n';

        userProxies.forEach((user, index) => {
          message += `<b>№${index + 1} | ${user.role}:</b>\n`;
          message += `<b>Имя пользователя:</b> ${user.username} / ${user.username} \n`;
          message += `<b>Telegram ID:</b> ${user.telegramId}\n`;
          message += `<b>Баланс:</b> ${user.balance}$\n`;
          message += `<b>Дата регистрации:</b> ${formatter.format(user.createdAt)}\n\n`;
        });
      } else {
        message = 'Нет зарегистрированных пользователей прокси.';
      }

      // Добавляем текущее время к тексту сообщения для обновления
      message += `Последнее обновление: ${formatter.format(new Date())}`;

      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Обновить', callback_data: 'admin_users' }],
            [{ text: '🔙 Назад', callback_data: 'admin_panel' }],
          ],
        },
      };

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        ...options,
      });
    }

    if (!result) {
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleAdminProxies(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramId = callbackQuery.from.id;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (result.permission) {
      const proxies = await ProxyModel.find();

      let message = '<b>Все прокси:</b>\n\n';
      proxies.forEach((proxy, index) => {
        message += `<b>Прокси ${proxy.login}: - ${
          proxy.isFree ? 'СВОБОДНО' : `ЗАНЯТО ${proxy.userTelegramId} `
        }</b>\n`;
        message += `Host: ${proxy.hostIp}\n`;
        message += `Socks порт: ${proxy.socksPort}\n`;
        message += `HTTP порт: ${proxy.httpPort}\n`;
        message += `Логин: ${proxy.login}\n`;
        message += `Пароль: ${proxy.password}\n`;
        message += `Ссылка для смены IP: <code>${proxy.changeIpUrl}</code>\n`;
        proxy.expirationDate
          ? (message += `Дата окончания: ${formatter.format(proxy.expirationDate)}\n\n`)
          : ``;
      });

      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Выдать прокси', callback_data: 'admin_assign_proxy' }],
            [{ text: '🔙 Назад', callback_data: 'admin_panel' }],
          ],
        },
      };

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } else {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleAdminBalanceTopUps(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramId = callbackQuery.from.id;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (result.permission) {
      const transactions = await BalanceTopUpModel.find().populate('userId');

      if (transactions.length === 0) {
        const noTransactionsMessage = 'Пока что нет пополнений баланса.';
        const options = {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin_panel' }]],
          },
        };
        bot.editMessageText(noTransactionsMessage, options);
        return;
      }

      let message = 'Список пополнений баланса:\n\n';
      transactions.forEach((transaction, index) => {
        message += `№${index + 1}\n`;
        message += `Пользователь: ${transaction.userId.username}\n`;
        message += `Сумма: ${formatAmount(transaction.amount)}\n`;
        message += `Дата: ${transaction.createdAt}\n\n`;
      });

      const options = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'admin_panel' }]],
        },
      };
      bot.editMessageText(message, options);
    }

    if (!result) {
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

// export async function handleAssignProxy(bot, callbackQuery) {
//   const chatId = callbackQuery.message.chat.id;
//   const messageId = callbackQuery.message.message_id;
//   const telegramId = callbackQuery.from.id;

//   try {
//     const result = await checkAuth(telegramId, 'admin');

//     if (result.permission) {
//       const proxies = await ProxyModel.find({ isFree: true });

//       if (proxies.length === 0) {
//         bot.sendMessage(chatId, 'Нет доступных прокси для выдачи.');
//         return;
//       }

//       const proxyButtons = proxies.map((proxy) => ({
//         text: `Выдать прокси (${proxy.login})`,
//         callback_data: `admin_assign_proxy_days_${proxy._id}`,
//       }));

//       const options = {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [proxyButtons, [{ text: '🔙 Назад', callback_data: 'admin_proxies' }]],
//         },
//       };

//       // Проверяем, изменилось ли содержимое сообщения
//       const currentMessage = callbackQuery.message.text;
//       const newMessage = 'Выберите прокси для выдачи:';
//       if (currentMessage !== newMessage) {
//         await bot.editMessageText(newMessage, {
//           chat_id: chatId,
//           message_id: messageId,
//           ...options,
//         });
//       }
//     } else {
//       bot.sendMessage(chatId, 'У вас нет прав на это действие.');
//     }
//   } catch (err) {
//     console.error('Ошибка:', err.message);
//     bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
//   }
// }

// export async function handleAssignProxyDays(bot, callbackQuery) {
//   const chatId = callbackQuery.message.chat.id;
//   const messageId = callbackQuery.message.message_id;
//   const proxyId = callbackQuery.data.split('_')[3]; // Получаем ID прокси из callback_data

//   try {
//     const result = await checkAuth(callbackQuery.from.id, 'admin');

//     if (result.permission) {
//       // Создаем кнопки с выбором количества дней
//       const dayButtons = [];
//       for (let i = 1; i <= 30; i++) {
//         dayButtons.push({ text: `${i} дней`, callback_data: `admin_assign_proxy_${proxyId}_${i}` });
//       }

//       const options = {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [dayButtons, [{ text: '🔙 Назад', callback_data: 'admin_proxies' }]],
//         },
//       };

//       // Проверяем, изменилось ли содержимое сообщения
//       const currentMessage = callbackQuery.message.text;
//       const newMessage = 'Выберите количество дней для выдачи прокси:';
//       if (currentMessage !== newMessage) {
//         await bot.editMessageText(newMessage, {
//           chat_id: chatId,
//           message_id: messageId,
//           ...options,
//         });
//       }
//     } else {
//       bot.sendMessage(chatId, 'У вас нет прав на это действие.');
//     }
//   } catch (err) {
//     console.error('Ошибка:', err.message);
//     bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
//   }
// }
