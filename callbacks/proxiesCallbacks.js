import ProxyModel from '../db/models/ProxyModel.js';
import TransactionModel from '../db/models/TransactionModel.js';
import PriceModel from '../db/models/PriceModel.js';

import { formatter } from '../callbacks.js';
import checkAuth from '../db/middleware/checkAuth.js';
import { getTransactionsByTelegramId } from '../createTransaction.js';

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
          proxiesMessage += `<b>Host:</b> <code>${proxy.hostIp}</code>\n`;
          proxiesMessage += `<b>Socks порт:</b> <code>${proxy.socksPort}</code>\n`;
          proxiesMessage += `<b>HTTP порт:</b> <code>${proxy.httpPort}</code>\n`;
          proxiesMessage += `<b>Логин:</b> <code>${proxy.login}</code>\n`;
          proxiesMessage += `<b>Пароль:</b> <code>${proxy.password}</code>\n`;
          proxiesMessage += `<b>Ссылка для смены IP:</b> <code>${proxy.changeIpUrl}</code>\n`;
          proxiesMessage += `<b>Дата окончания:</b> ${formatter.format(proxy.expirationDate)}\n\n`;
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
              { text: '🔙 Назад', callback_data: 'login_or_register' },
            ],
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
  const telegramId = callbackQuery.from.id;

  try {
    // Получаем количество доступных прокси
    const availableProxiesCount = await ProxyModel.countDocuments({ isFree: true });

    const transactions = await TransactionModel.find({ telegramId });
    await getTransactionsByTelegramId(transactions);

    // Определяем стиль отображения количества в зависимости от их числа
    const proxiesCountMessage =
      availableProxiesCount > 0
        ? `<b>${availableProxiesCount}</b>`
        : `<b>❗️${availableProxiesCount}</b>`;

    // Получаем цены для аренды прокси
    const prices = await PriceModel.find({
      description: { $in: ['week', 'month'] },
    }).sort({ description: 1 });

    const weekPrice = prices.find((price) => price.description === 'week');
    const monthPrice = prices.find((price) => price.description === 'month');

    const keyboard = {
      inline_keyboard: [
        [
          { text: `7 дней (${weekPrice.amount}$)`, callback_data: 'rent_7_days' },
          { text: `30 дней (${monthPrice.amount}$)`, callback_data: 'rent_30_days' },
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
    console.log('Ошибка при получении доступных прокси:', err.message);
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

      // Получаем цены для аренды прокси
      const prices = await PriceModel.find({
        description: { $in: ['week', 'month'] },
      }).sort({ description: 1 });

      const weekPrice = prices.find((price) => price.description === 'week');
      const monthPrice = prices.find((price) => price.description === 'month');

      if (action === 'rent_7_days') {
        days = 7;
        price = weekPrice.amount;
      } else if (action === 'rent_30_days') {
        days = 30;
        price = monthPrice.amount;
      } else {
        throw new Error('Invalid action');
      }

      const user = result.user;
      const proxy = await ProxyModel.findOne({ isFree: true });

      let confirmationMessage = '';

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
        inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'buy_proxies' }]],
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
