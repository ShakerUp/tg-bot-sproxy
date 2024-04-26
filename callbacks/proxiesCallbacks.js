import ProxyModel from '../db/models/ProxyModel.js';
import testProxy from '../bot/utils/proxyCheck.js';

import { formatter } from '../callbacks.js';
import checkAuth from '../db/middleware/checkAuth.js';

export async function handleMyProxies(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;

  try {
    const result = await checkAuth(telegramId, ['admin', 'user']);
    if (result.permission) {
      const userProxies = await ProxyModel.find({ userTelegramId: telegramId });

      let proxiesMessage;
      if (userProxies.length > 0) {
        proxiesMessage = '<b>🔗 Ваши прокси: 🔗</b>\n\n';
        userProxies.forEach((proxy, index) => {
          proxiesMessage += `<b>Прокси №${index + 1}:</b>\n`;
          proxiesMessage += `Host: ${proxy.hostIp}\n`;
          proxiesMessage += `Socks порт: ${proxy.socksPort}\n`;
          proxiesMessage += `HTTP порт: ${proxy.httpPort}\n`;
          proxiesMessage += `Логин: ${proxy.login}\n`;
          proxiesMessage += `Пароль: ${proxy.password}\n`;
          proxiesMessage += `Ссылка для смены IP: <code>${proxy.changeIpUrl}</code>\n`;
          proxiesMessage += `Дата окончания: ${formatter.format(proxy.expirationDate)}\n\n`;
        });
      } else {
        proxiesMessage = 'У вас пока нет купленных прокси.';
      }

      const proxiesOptions = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Купить прокси', callback_data: 'buy_proxies' },
              // { text: '✍️ Проверить прокси', callback_data: 'check_proxy' },
            ],
            [{ text: '🔙 Назад', callback_data: 'login_or_register' }],
          ],
        },
      };

      bot.editMessageText(proxiesMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...proxiesOptions,
      });
    } else {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export const handleBuyProxies = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Получаем количество доступных прокси
    const availableProxiesCount = await ProxyModel.countDocuments({ isFree: true });

    // Определяем стиль отображения количества в зависимости от их числа
    const proxiesCountMessage =
      availableProxiesCount > 0
        ? `<b>${availableProxiesCount}</b>`
        : `<b>❗️${availableProxiesCount}</b>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '7 дней (8$)', callback_data: 'rent_7_days' },
          { text: '30 дней (25$)', callback_data: 'rent_30_days' },
        ],
        [{ text: '🔙 Назад', callback_data: 'my_proxies' }],
      ],
    };

    bot.editMessageText(
      `В наличии ${proxiesCountMessage} свободных прокси. Выберите опцию аренды:`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      },
    );
  } catch (err) {
    console.error('Ошибка при получении доступных прокси:', err.message);
    bot.editMessageText(
      'Произошла ошибка при попытке получить доступные прокси. Попробуйте позже.',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
      },
    );
  }
};

export async function checkProxy(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id; // Получаем идентификатор существующего сообщения

  try {
    const userProxies = await ProxyModel.find({ userId: telegramId });

    let message = '';
    if (userProxies.length > 0) {
      message += `<b>Результат проверки:</b>\n\n`;
      for (let i = 0; i < userProxies.length; i++) {
        const proxy = userProxies[i];
        const isWorking = await testProxy(proxy);
        message += `Прокси №${i + 1}: ${isWorking ? 'Работает🟢' : 'Не работает🔴'}\n`;
      }
    } else {
      message = 'У вас пока нет купленных прокси.';
    }

    // Создаем кнопки
    const keyboard = {
      inline_keyboard: [[{ text: 'Мои прокси', callback_data: 'my_proxies' }]],
    };

    // Изменяем существующее сообщение с кнопками
    bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: 'HTML', // Указываем, что сообщение поддерживает HTML форматирование
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleRentProxy(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const action = callbackQuery.data;
  const userId = callbackQuery.from.id;

  try {
    const result = await checkAuth(userId, ['user', 'admin']);

    if (result.permission) {
      let days;
      let price;

      if (action === 'rent_7_days') {
        days = 7;
        price = 8;
      } else if (action === 'rent_30_days') {
        days = 30;
        price = 25;
      } else {
        throw new Error('Invalid action');
      }

      const user = result.user;
      const proxy = await ProxyModel.findOne({ isFree: true });

      let confirmationMessage = ``;

      if (!proxy) {
        confirmationMessage += 'Извините, нет доступных прокси в данный момент.';
      } else {
        if (user.balance < price) {
          confirmationMessage += 'Недостаточно средств на балансе.';
        } else {
          // Уменьшаем баланс пользователя на сумму покупки
          user.balance -= price;
          await user.save();

          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + days);

          // Обновляем модель прокси
          proxy.isFree = false;
          proxy.expirationDate = expirationDate;
          proxy.userTelegramId = userId;
          proxy.userId = user._id;

          await proxy.save();

          confirmationMessage += `Вы успешно приобрели прокси на ${days} дней за ${price}$.`;
        }
      }

      const keyboard = {
        inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'my_proxies' }]],
      };

      bot.editMessageText(confirmationMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    } else {
      bot.editMessageText('У вас нет прав на это действие.', {
        chat_id: chatId,
        message_id: messageId,
      });
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.editMessageText('Произошла ошибка. Попробуйте позже.', {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}
