// callbacks.js
import UserModel from './db/models/UserModel.js';

import {
  handleAdminPanel,
  handleAdminUsers,
  handleAdminProxies,
  handleAdminBalanceTopUps,
  checkAllProxies,
  handleViewAllTransactions,
} from './callbacks/adminCallbacks.js';
import {
  handleMyProxies,
  checkProxy,
  handleBuyProxies,
  handleRentProxy,
} from './callbacks/proxiesCallbacks.js';
import {
  handleMyBalance,
  handleTopupBalance,
  handleTopupBalance8,
  handleTopupBalance25,
  handleTopupBalance1,
} from './callbacks/balanceCallbacks.js';

const actionHandlers = {
  login_or_register: handleUser,
  accept: handleAccept,
  decline: handleDecline,
  back: handleBack,
  my_proxies: handleMyProxies,
  check_proxy: checkProxy,
  admin_panel: handleAdminPanel,
  admin_users: handleAdminUsers,
  admin_proxies: handleAdminProxies,
  my_balance: handleMyBalance,
  topup_balance: handleTopupBalance,
  topup_8: handleTopupBalance8,
  topup_25: handleTopupBalance25,
  topup_1: handleTopupBalance1,
  buy_proxies: handleBuyProxies,
  rent_7_days: handleRentProxy,
  rent_30_days: handleRentProxy,
  admin_balance_top_ups: handleAdminBalanceTopUps,
  documents: handleDocuments,
  check_all_proxies: checkAllProxies,
  admin_transactions: handleViewAllTransactions, // Добавляем новую функцию
};

const userAgreementURL =
  'https://docs.google.com/document/d/17QsXL8k_zCq6i8F-yKxqGsnQ2ROwt4PZUZPhPiq_6Vs/edit?usp=sharing';
const privacyPolicyURL =
  'https://docs.google.com/document/d/1idyS_5VNLUdn6LJpJKVn6mvbNZ3_YGAyif9KIAIX-_E/edit?usp=sharing';
const securityPolicyURL =
  'https://docs.google.com/document/d/16xhrk9nMMW1PnHkfpINpfu2i2wGeVKkt3iUw5Z9vDFY/edit?usp=sharing';

const options = {
  timeZone: 'Europe/Kiev',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};
export const formatter = new Intl.DateTimeFormat('uk-UA', options);

export async function handleCallback(bot, callbackQuery) {
  const action = callbackQuery.data;
  const handler = actionHandlers[action];

  if (handler) {
    await handler(bot, callbackQuery);
  } else if (action.startsWith('admin_users_')) {
    await handleAdminUsers(bot, callbackQuery);
  } else if (action.startsWith('admin_proxies_')) {
    await handleAdminProxies(bot, callbackQuery);
  } else {
    console.error('Неверное действие:', action);
  }
}

async function handleUser(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const firstName = callbackQuery.from.first_name;

  try {
    const user = await UserModel.findOne({ telegramId });

    if (user) {
      const profileMessage = `<b>Профиль пользователя:</b>\n\n<b>ID:</b> ${
        user.telegramId
      }\n<b>Ваше имя:</b> ${firstName}\n<b>Баланс:</b> ${
        user.balance
      }$\n<b>Дата регистрации:</b> ${formatter.format(user.createdAt)}`;
      const profileOptions = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔗 Мои прокси', callback_data: 'my_proxies' },
              { text: '💰 Мой баланс', callback_data: 'my_balance' },
            ],
            [
              { text: '📋 Документы', callback_data: 'documents' },
              { text: '🔙 Назад', callback_data: 'back' },
            ],
            user.role === 'admin'
              ? [{ text: '🛠️ Админ панель', callback_data: 'admin_panel' }]
              : [], // Добавляем кнопку только если пользователь администратор
          ],
        },
      };
      bot.editMessageText(profileMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...profileOptions,
      });
    } else {
      const registerMessage = `Для регистрации необходимо принять <a href="${userAgreementURL}">Пользовательское соглашение</a> и <a href="${privacyPolicyURL}">Политику конфиденциальности</a>. Принять?`;
      const registerOptions = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✔️ Принять', callback_data: 'accept' },
              { text: '❌ Отказаться', callback_data: 'decline' },
            ],
            [{ text: '📑 На главную', callback_data: 'back' }],
          ],
        },
      };
      bot.editMessageText(registerMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...registerOptions,
      });
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

async function handleDocuments(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const documentsMessage = 'Выберите документ для просмотра:';
  const documentsOptions = {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Пользовательское соглашение', url: userAgreementURL }],
        [{ text: 'Политика конфиденциальности', url: privacyPolicyURL }],
        [{ text: 'Политика безопасности', url: securityPolicyURL }],
        [{ text: '🔙 Назад', callback_data: 'back' }],
      ],
    },
  };
  bot.editMessageText(documentsMessage, {
    chat_id: chatId,
    message_id: callbackQuery.message.message_id,
    ...documentsOptions,
  });
}

async function handleAccept(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;
  const username = callbackQuery.from.username;
  const firstName = callbackQuery.from.first_name;

  try {
    await UserModel.create({ chatId, telegramId, username, firstName });
    const successMessage = 'Вы успешно зарегистрированы!';
    const successOptions = {
      reply_markup: {
        inline_keyboard: [[{ text: '📑 На главную', callback_data: 'back' }]],
      },
    };
    bot.editMessageText(successMessage, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      ...successOptions,
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

async function handleDecline(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;

  const declineMessage = 'Вы отказались от регистрации.';
  const declineOptions = {
    reply_markup: {
      inline_keyboard: [[{ text: '📑 На главную', callback_data: 'back' }]],
    },
  };
  bot.editMessageText(declineMessage, {
    chat_id: chatId,
    message_id: callbackQuery.message.message_id,
    ...declineOptions,
  });
}

async function handleBack(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;

  const welcomeMessage = 'Для входа в свой профиль или регистрации нажмите кнопку ниже.';
  const welcomeOptions = {
    reply_markup: {
      inline_keyboard: [[{ text: 'Войти/Зарегистрироваться', callback_data: 'login_or_register' }]],
    },
  };
  bot.editMessageText(welcomeMessage, {
    chat_id: chatId,
    message_id: callbackQuery.message.message_id,
    ...welcomeOptions,
  });
}
