// commands.js
import checkAuth from './db/middleware/checkAuth.js';
import ProxyModel from './db/models/ProxyModel.js';
import UserModel from './db/models/UserModel.js';

export function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const messageOptions = {
    reply_markup: {
      inline_keyboard: [[{ text: 'Войти/Зарегистрироваться', callback_data: 'login_or_register' }]],
    },
  };

  bot.sendMessage(
    chatId,
    'Добро пожаловать! Для входа или регистрации нажмите кнопку ниже.',
    messageOptions,
  );
}

export async function handleFreeProxy(bot, msg, match) {
  const chatId = msg.chat.id;
  const proxyLogin = match[1];
  const newProxyPassword = match[2];

  try {
    const result = await checkAuth(msg.from.id, 'admin');

    if (result.permission) {
      const proxy = await ProxyModel.findOne({ login: proxyLogin });

      if (!proxy) {
        bot.sendMessage(chatId, 'Прокси с таким логином не найден.');
        return;
      }

      // Обновляем информацию о прокси
      proxy.isFree = true;
      proxy.expirationDate = null; // Сбрасываем дату окончания
      proxy.password = newProxyPassword;
      proxy.userTelegramId = null;
      proxy.userId = null;

      await proxy.save();

      bot.sendMessage(chatId, `Прокси ${proxyLogin} освобожден и установлен новый пароль.`);
    } else {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleGiveProxy(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const [, targetUserId, amountOfDays] = match;

  try {
    // Проверяем права администратора
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    // Проверяем, что количество дней указано и является числом
    if (!amountOfDays || isNaN(amountOfDays)) {
      bot.sendMessage(chatId, 'Некорректное количество дней.');
      return;
    }

    // Находим пользователя, которому нужно выдать прокси
    const targetUser = await UserModel.findOne({ telegramId: targetUserId });
    if (!targetUser) {
      bot.sendMessage(chatId, 'Пользователь не найден.');
      return;
    }

    // Проверяем наличие свободной прокси
    const proxy = await ProxyModel.findOne({ isFree: true });

    if (!proxy) {
      bot.sendMessage(chatId, 'Извините, нет доступных прокси в данный момент.');
      return;
    }

    // Устанавливаем срок окончания
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + parseInt(amountOfDays));

    // Обновляем модель прокси
    proxy.isFree = false;
    proxy.userTelegramId = targetUser.telegramId;
    proxy.expirationDate = expirationDate;
    await proxy.save();

    // Отправляем сообщение о выдаче прокси
    bot.sendMessage(targetUser.chatId, `Вам выдали прокси на ${amountOfDays} дней.`);

    // Отправляем подтверждение об успешной выдаче прокси администратору
    bot.sendMessage(chatId, `Прокси успешно выдано пользователю ${targetUser.username}.`);
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}
