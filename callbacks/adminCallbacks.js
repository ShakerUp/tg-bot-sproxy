import checkAuth from '../db/middleware/checkAuth.js';
import UserModel from '../db/models/UserModel.js';
import ProxyModel from '../db/models/ProxyModel.js';
import BalanceTopUpModel from '../db/models/BalanceTopUpModel.js';

import testProxy from '../bot/utils/proxyCheck.js';

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
            ],
            [
              { text: 'Пополнения баланса', callback_data: 'admin_balance_top_ups' },
              // { text: 'Проверить все прокси', callback_data: 'check_all_proxies' },
              { text: '🔙 Назад', callback_data: 'login_or_register' },
            ],
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

const chunkSize = 4000;

export async function handleAdminUsers(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramId = callbackQuery.from.id;
  const data = callbackQuery.data;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    const userProxies = await UserModel.find();
    let messages = [];
    let message = '<b>Все пользователи:</b>\n\n';

    userProxies.forEach((user, index) => {
      let userInfo = `<b>№${index + 1} | ${user.role}:</b>\n`;
      userInfo += `<b>Имя пользователя:</b> ${user.username} / ${user.firstName} \n`;
      userInfo += `<b>Telegram ID:</b> ${user.telegramId}\n`;
      userInfo += `<b>Баланс:</b> ${user.balance}$\n`;
      userInfo += `<b>Дата регистрации:</b> ${formatter.format(user.createdAt)}\n\n`;

      if ((message + userInfo).length > chunkSize) {
        messages.push(message);
        message = '';
      }

      message += userInfo;
    });

    // Добавляем последнее сообщение с остатками информации и временем обновления
    message += `Последнее обновление: ${formatter.format(new Date())}`;
    messages.push(message);

    // Отправляем только первую часть сообщения при первом вызове
    if (data === 'admin_users') {
      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Далее', callback_data: 'admin_users_1' }],
            [{ text: '🔙 Назад', callback_data: 'admin_panel' }],
          ],
        },
      };

      await bot.editMessageText(messages[0], {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } else {
      // Определяем текущую страницу и показываем соответствующую часть сообщения
      const pageIndex = parseInt(data.split('_')[2], 10);
      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...(pageIndex > 0
              ? [[{ text: 'Назад', callback_data: `admin_users_${pageIndex - 1}` }]]
              : []),
            ...(pageIndex < messages.length - 1
              ? [[{ text: 'Далее', callback_data: `admin_users_${pageIndex + 1}` }]]
              : []),
            [{ text: '🔙 Назад', callback_data: 'admin_panel' }],
          ],
        },
      };

      await bot.editMessageText(messages[pageIndex], {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
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
      const proxies = await ProxyModel.find().sort({ login: 1 });
      const users = await UserModel.find({
        telegramId: { $in: proxies.map((proxy) => proxy.userTelegramId) },
      });

      const usersMap = {};
      users.forEach((user) => {
        usersMap[user.telegramId] = user;
      });

      let message = '<b>Все прокси:</b>';
      proxies.forEach((proxy, index) => {
        let userName = proxy.isFree
          ? 'СВОБОДНО'
          : `ЗАНЯТО ${
              usersMap[proxy.userTelegramId]
                ? usersMap[proxy.userTelegramId].username
                : proxy.userTelegramId
            } ${getTimeRemaining(proxy.expirationDate)}`;

        message += `\n\n<b>Прокси ${proxy.login}: - ${userName}</b>\n`;
        message += `Host: ${proxy.hostIp}\n`;
        message += `Socks порт: ${proxy.socksPort}\n`;
        message += `HTTP порт: ${proxy.httpPort}\n`;
        message += `Логин: ${proxy.login}\n`;
        message += `Пароль: ${proxy.password}\n`;
        message += `Ссылка для смены IP: <code>${proxy.changeIpUrl}</code>\n`;
        proxy.expirationDate
          ? (message += `Дата окончания: ${formatter.format(proxy.expirationDate)}`)
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

function getTimeRemaining(expirationDate) {
  if (!expirationDate) return '';
  const now = new Date();
  const diff = expirationDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) {
    return `${days} дн. ${hours} час.`;
  } else {
    return `${hours} час.`;
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

export async function checkAllProxies(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const result = await checkAuth(telegramId, 'admin');

    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    const proxies = await ProxyModel.find();

    let message = '';
    if (proxies.length > 0) {
      message += `<b>Результат проверки всех прокси:</b>\n\n`;
      for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        const isWorking = await testProxy(proxy);
        message += `Прокси ${proxy.login}: ${isWorking ? 'Работает🟢' : 'Не работает🔴'}\n`;
      }
    } else {
      message = 'Нет прокси для проверки.';
    }

    // Создаем кнопки
    const keyboard = {
      inline_keyboard: [[{ text: 'Админ панель', callback_data: 'admin_panel' }]],
    };

    // Изменяем существующее сообщение с кнопками
    bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}
