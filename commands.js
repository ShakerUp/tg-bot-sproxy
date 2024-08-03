// commands.js
import checkAuth from './db/middleware/checkAuth.js';
import ProxyModel from './db/models/ProxyModel.js';
import UserModel from './db/models/UserModel.js';
import PriceModel from './db/models/PriceModel.js';

import Decimal from 'decimal.js';

import { differenceInHours } from 'date-fns';

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
  const newChangeIpUrl = match[3]; // Новый параметр для ссылки на смену IP

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
      proxy.changeIpUrl = newChangeIpUrl; // Обновляем ссылку на смену IP

      await proxy.save();

      bot.sendMessage(
        chatId,
        `Прокси ${proxyLogin} освобожден, установлен новый пароль, и обновлена ссылка для смены IP.`,
      );
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
  const [, proxyLogin, targetUserId, amountOfDaysString] = match;

  console.log(amountOfDaysString);
  try {
    // Проверяем права администратора
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    // Проверяем, что количество дней указано и является числом
    const amountOfDays = parseFloat(amountOfDaysString);
    if (isNaN(amountOfDays)) {
      bot.sendMessage(chatId, 'Некорректное количество дней.');
      return;
    }

    // Находим пользователя, которому нужно выдать прокси
    const targetUser = await UserModel.findOne({ telegramId: parseInt(targetUserId) });
    if (!targetUser) {
      bot.sendMessage(chatId, 'Пользователь не найден.');
      return;
    }

    // Находим прокси по логину
    const proxy = await ProxyModel.findOne({ login: proxyLogin });
    if (!proxy) {
      bot.sendMessage(chatId, 'Прокси с таким логином не найдено.');
      return;
    }

    // Проверяем, что прокси свободно
    if (!proxy.isFree) {
      bot.sendMessage(chatId, 'Прокси уже назначено другому пользователю.');
      return;
    }
    console.log(amountOfDays);
    // Устанавливаем срок окончания
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + amountOfDays * 24);

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

export async function addProxy(bot, message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const proxyData = message.text.split(' | ');

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }
    const socksMatch = proxyData.find((item) => item.includes('SOCKS5'));
    const httpMatch = proxyData.find((item) => item.includes('HTTP'));
    const changeIpMatch = proxyData.find((item) => item.includes('ChangeIP'));

    if (socksMatch && httpMatch && changeIpMatch) {
      // Извлекаем данные из сообщения
      const socksParts = socksMatch.split(': ');
      const httpParts = httpMatch.split(': ');
      const changeIpParts = changeIpMatch.split(': ');

      const hostIp = socksParts[1].split(':')[0];
      const socksPort = parseInt(socksParts[1].split(':')[1]);
      const login = socksParts[1].split(':')[2];
      const password = socksParts[1].split(':')[3];
      const httpPort = parseInt(httpParts[1].split(':')[1]);
      const changeIpUrl = changeIpParts[1].trim();

      // Создаем новую запись прокси
      const newProxy = await ProxyModel.create({
        hostIp,
        socksPort,
        login,
        password,
        httpPort,
        changeIpUrl,
        isFree: true,
      });

      // Отправляем ответ пользователю
      const responseMessage = `Прокси успешно добавлена:\n\nHost IP: ${newProxy.hostIp}\nSOCKS Port: ${newProxy.socksPort}\nHTTP Port: ${newProxy.httpPort}\nLogin: ${newProxy.login}\nPassword: ${newProxy.password}\nChange IP URL: ${newProxy.changeIpUrl}`;
      bot.sendMessage(chatId, responseMessage);
    } else {
      // Если не удалось извлечь все данные
      bot.sendMessage(chatId, 'Ошибка: Не удалось извлечь все данные из сообщения.');
    }
  } catch (error) {
    console.error('Ошибка при добавлении прокси:', error.message);
    bot.sendMessage(chatId, 'Произошла ошибка при добавлении прокси. Попробуйте позже.');
  }
}

export async function allNoProxy(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = match[1];

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }
    const usedProxies = await ProxyModel.find({ isFree: false }).distinct('userTelegramId');

    const usersWithoutProxy = await UserModel.find({ telegramId: { $nin: usedProxies } });

    for (const user of usersWithoutProxy) {
      bot.sendMessage(user.chatId, messageText);
    }

    bot.sendMessage(
      chatId,
      `Сообщение успешно отправлено ${usersWithoutProxy.length} пользователям без прокси.`,
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleAllUsers(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = match[1];

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }
    const allUsers = await UserModel.find();

    for (const user of allUsers) {
      bot.sendMessage(user.chatId, messageText);
    }

    bot.sendMessage(chatId, `Сообщение успешно отправлено ${allUsers.length} пользователям.`);
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function allWithProxy(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = match[1];

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }
    // Найти всех пользователей, у которых есть прокси
    const usedProxies = await ProxyModel.find({ isFree: false }).distinct('userTelegramId');

    const usersWithProxy = await UserModel.find({ telegramId: { $in: usedProxies } });

    for (const user of usersWithProxy) {
      bot.sendMessage(user.chatId, messageText);
    }

    bot.sendMessage(
      chatId,
      `Сообщение успешно отправлено ${usersWithProxy.length} пользователям с прокси.`,
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function notifyUsers(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    // Найти все занятые прокси
    const occupiedProxies = await ProxyModel.find({ isFree: false });

    const usersToNotify = [];

    occupiedProxies.forEach((proxy) => {
      const hoursRemaining = differenceInHours(new Date(proxy.expirationDate), new Date());

      if (hoursRemaining < 24) {
        usersToNotify.push({
          userId: proxy.userTelegramId,
          hoursRemaining,
        });
      }
    });

    // Отправить уведомления пользователям
    for (const { userId, hoursRemaining } of usersToNotify) {
      await bot.sendMessage(
        userId,
        `Напоминание! До окончания срока вашей прокси осталось ${hoursRemaining} часов.`,
      );
    }

    bot.sendMessage(chatId, `Оповещения успешно отправлены ${usersToNotify.length} пользователям.`);
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleUpdateProxyPass(bot, msg, match) {
  const chatId = msg.chat.id;
  const proxyLogin = match[1];
  const newProxyPassword = match[2];
  const newChangeIpUrl = match[3]; // Новый параметр для ссылки на смену IP

  try {
    const result = await checkAuth(msg.from.id, 'admin');

    if (result.permission) {
      const proxy = await ProxyModel.findOne({ login: proxyLogin });

      if (!proxy) {
        bot.sendMessage(chatId, 'Прокси с таким логином не найден.');
        return;
      }

      // Обновляем пароль и ссылку для смены IP прокси
      proxy.password = newProxyPassword;
      proxy.changeIpUrl = newChangeIpUrl; // Обновляем ссылку для смены IP
      await proxy.save();

      bot.sendMessage(chatId, `Пароль для прокси ${proxyLogin} и ссылка для смены IP обновлены.`);
    } else {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleUpdateProxyDuration(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const proxyLogin = match[1];
  const durationChange = parseFloat(match[2]);

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    const proxy = await ProxyModel.findOne({ login: proxyLogin });
    if (!proxy) {
      bot.sendMessage(chatId, `Прокси с логином ${proxyLogin} не найден.`);
      return;
    }

    if (proxy.isFree) {
      bot.sendMessage(chatId, `Прокси ${proxyLogin} свободен и не может быть обновлен.`);
      return;
    }

    const newExpirationDate = new Date(proxy.expirationDate);
    newExpirationDate.setDate(newExpirationDate.getDate() + durationChange);

    proxy.expirationDate = newExpirationDate;
    await proxy.save();

    bot.sendMessage(
      chatId,
      `Срок действия прокси ${proxyLogin} успешно обновлен. Новая дата окончания: ${newExpirationDate.toLocaleString()}.`,
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export const handleUpdateProxyPrice = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const command = msg.text.trim();

  // Разбираем команду и параметры
  const [commandName, description, amountStr] = command.split(' ');

  // Проверяем права пользователя
  const result = await checkAuth(userId, ['admin']);
  if (!result.permission) {
    return bot.sendMessage(chatId, 'У вас нет прав на выполнение этой команды.');
  }

  // Проверяем корректность входных данных
  if (!description || isNaN(amountStr) || !['week', 'month'].includes(description)) {
    return bot.sendMessage(
      chatId,
      'Неверный формат команды. Используйте /updateproxyprice <description> <amount>.',
    );
  }

  // Обрабатываем цену и проверяем её корректность
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(
      chatId,
      'Неверная цена. Убедитесь, что цена является положительным числом.',
    );
  }

  try {
    // Обновляем цену в базе данных
    const result = await PriceModel.updateOne({ description }, { $set: { amount } });

    if (result.matchedCount === 0) {
      return bot.sendMessage(chatId, `Цена для описания "${description}" не найдена.`);
    }

    bot.sendMessage(chatId, `Цена для "${description}" обновлена на ${amount.toFixed(2)}$.`);
  } catch (err) {
    console.error('Ошибка обновления цены:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка при обновлении цены. Попробуйте позже.');
  }
};

export async function handleUpdateUserBalance(bot, message, type) {
  const chatId = message.chat.id;
  const text = message.text.split(' ');

  // Проверяем, что команда имеет правильный формат
  if (text.length !== 3) {
    return bot.sendMessage(
      chatId,
      'Неверный формат команды. Используйте: /updateuserbalance <id> <+/-сумма>',
    );
  }

  const userId = text[1];
  const amountStr = text[2];

  // Проверяем формат суммы с учетом знаков + и -
  if (!/^([+-])?(\d+(\.\d{1,2})?)$/.test(amountStr)) {
    return bot.sendMessage(
      chatId,
      'Неверный формат суммы. Используйте формат +X.0, +X.X, -X.0 или -X.X, где X - цифры.',
    );
  }

  // Определяем знак суммы и преобразуем его в число с использованием Decimal.js
  let amount = new Decimal(amountStr);

  // Округляем сумму до двух знаков после запятой
  amount = amount.toDecimalPlaces(2);

  try {
    const result = await checkAuth(userId, ['admin']);
    if (!result.permission) {
      return bot.sendMessage(chatId, 'У вас нет прав на выполнение этой команды.');
    }
    // Находим пользователя по ID
    const user = await UserModel.findOne({ telegramId: userId });

    if (!user) {
      return bot.sendMessage(chatId, 'Пользователь не найден.');
    }

    // Обновляем баланс

    user.balance = new Decimal(user.balance || 0).plus(amount).toNumber();
    if (type === 'ref') {
      user.refEarnings = new Decimal(user.refEarnings || 0).plus(amount).toNumber();
    }
    await user.save();

    bot.sendMessage(
      chatId,
      `Баланс пользователя ${userId} успешно обновлен на ${amount.toString()}$`,
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка при обновлении баланса.');
  }
}

export async function handleBroadcast(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const messageText = `
👀 <b>Хотим с радостью объявить о скидках и нововведениях!</b>

🎁 <b>Скидки:</b>
--- Начиная <b>с 03.08 по 10.08</b> будут действовать скидки в размере <b>15%</b>! 
<b>30 дней</b> - <s>26$</s> <b>22$</b>; <b>7 дней</b> - <s>9$</s> <b>7.5$</b>

✏️ <b>Нововведения:</b>
● <b>"Реферальная система":</b>
--- В бота добавлен раздел "Реферальная система". У каждого пользователя есть свой реферальный код, которым он может поделиться с другими пользователями бота, а также может ввести реферальной код другого пользователя, чтобы стать его рефералом. При пополнении баланса рефералами, Вы будете получать 10% от суммы их пополнений на Ваш баланс. Данные о кол-ве рефералов, а также дохода с реф. системы Вы также можете увидеть на странице "Реферальная система".
<i>*Примечание: Реферальный код можно ввести всего 1 раз и изменить его нельзя.</i>
● <b>"Изменения при пополнении баланса":</b>
--- Теперь Вы можете пополнить баланс украинской карточкой на уникальную сумму, которую Вы задаете сами. Пополнение через криптовалюту происходит через тех.поддержку. 
<i>*Примечание:  При пополнении баланса криптовалютой, и при наличии у Вас введеного реферального кода, вашему рефереру будет начислен бонус 10% в течении 15 минут после пополнения.</i>

--- Небольшие доработки и улучшение в интерфейсе.

<i>А также, мы создали канал <b><a href="https://t.me/simplepr0xy">[Channel] SimpleProxy</a></b>, где будем оповещать Вас о различных новостях и т.п, дабы не засорять бота.</i>

<b>Всем хорошего вечера!🌃</b>
`;

  try {
    const result = await checkAuth(userId, 'admin');
    if (!result.permission) {
      bot.sendMessage(chatId, 'У вас нет прав на это действие.');
      return;
    }

    const allUsers = await UserModel.find();
    let successfulSends = 0;
    let failedSends = 0;

    for (const user of allUsers) {
      try {
        await bot.sendMessage(user.chatId, messageText, { parse_mode: 'HTML' });
        successfulSends++;
      } catch (err) {
        console.error(
          `Ошибка с отправлением сообщения пользователю с айди: ${user.chatId}`,
          err.message,
        );
        bot.sendMessage(
          chatId,
          `Ошибка с отправлением сообщения пользователю с айди: ${user.chatId}`,
        );
        failedSends++;
      }
    }

    bot.sendMessage(
      chatId,
      `Сообщение успешно отправлено ${successfulSends} пользователям. Ошибок: ${failedSends}.`,
    );
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}
