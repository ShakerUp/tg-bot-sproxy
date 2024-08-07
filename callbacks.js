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
  handleBuyProxies,
  handleRentProxy,
} from './callbacks/proxiesCallbacks.js';
import {
  handleMyBalance,
  handleTopupBalance,
  handleTopupBalanceGeneric,
  handleTopupCustom,
} from './callbacks/balanceCallbacks.js';

const actionHandlers = {
  login_or_register: handleUser,
  accept: handleAccept,
  decline: handleDecline,
  back: handleBack,
  my_proxies: handleMyProxies,
  admin_panel: handleAdminPanel,
  admin_users: handleAdminUsers,
  admin_proxies: handleAdminProxies,
  my_balance: handleMyBalance,
  topup_balance: handleTopupBalance,
  buy_proxies: handleBuyProxies,
  rent_7_days: handleRentProxy,
  rent_30_days: handleRentProxy,
  admin_balance_top_ups: handleAdminBalanceTopUps,
  documents: handleDocuments,
  check_all_proxies: checkAllProxies,
  admin_transactions: handleViewAllTransactions, // Добавляем новую функцию
  referral_system: handleReferral,
  topup_custom: handleTopupCustom,
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
  } else if (action.startsWith('admin_transactions_')) {
    await handleViewAllTransactions(bot, callbackQuery);
  } else if (action === 'enter_referral_code') {
    await handleReferralCodeEntry(bot, callbackQuery);
  } else if (action === 'referral_system') {
    await handleReferral(bot, callbackQuery);
  } else if (action.startsWith('topup_')) {
    await handleTopupBalanceGeneric(bot, callbackQuery); // Универсальный обработчик
  } else if (callbackData === 'topup_custom') {
    await handleTopupCustom(bot, callbackQuery);
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
      const profileMessage = `<b>Профиль пользователя:</b>\n\n<b>ID:</b> <code>${
        user.telegramId
      }</code>\n<b>Ваше имя:</b> ${firstName}\n<b>Баланс:</b> ${
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
              { text: '🚀 Реферальная система', callback_data: 'referral_system' },
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
        [{ text: '🔙 Назад', callback_data: 'login_or_register' }],
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

// Для хранения состояния ожидания, используйте объект (или базу данных для хранения сессий)
const waitingForReferralCode = new Set();
const referralInputHandlers = {};

export async function handleReferral(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;

  // Удаляем состояние ожидания и обработчик для реферального кода
  waitingForReferralCode.delete(chatId);
  if (referralInputHandlers[chatId]) {
    bot.removeListener('message', referralInputHandlers[chatId]);
    delete referralInputHandlers[chatId];
  }

  try {
    const user = await UserModel.findOne({ telegramId });

    if (user) {
      const referralCount = await UserModel.countDocuments({ refCode: user.telegramId });
      const referralEarnings = user.refEarnings || 0;

      let message = `<b>Реферальная система:</b>\n\n`;
      message += `<b>👋 Вы получаете 10% от пополнений ваших рефералов</b>\n\n`;
      message += `<b>🌐 Ваш реферальный код:</b> <code>${user.telegramId}</code>\n`;
      message += `<b>👨‍👩‍👦‍👦 Кол-во рефералов:</b> ${referralCount}\n`;
      message += `<b>💵 Заработок с реферальной системы: </b> ${referralEarnings}$\n`;

      user.refCode ? (message += `\n <b>✅ Вы являетесь рефералом</b> ${user.refCode}`) : '';

      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            user.refCode
              ? [{ text: '🔙 Назад', callback_data: 'login_or_register' }]
              : [
                  { text: '✍🏻 Ввести реферальный код', callback_data: 'enter_referral_code' },
                  { text: '🔙 Назад', callback_data: 'login_or_register' },
                ],
          ],
        },
      };

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...options,
      });
    } else {
      bot.sendMessage(chatId, 'Пользователь не найден.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

export async function handleReferralCodeEntry(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const telegramId = callbackQuery.from.id;

  try {
    const user = await UserModel.findOne({ telegramId });

    if (user) {
      // Устанавливаем состояние ожидания реферального кода
      waitingForReferralCode.add(chatId);

      // Отправляем сообщение для ввода реферального кода
      const message = '<b>Введите реферальный код:</b>';
      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'referral_system' }]],
        },
      };

      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...options,
      });

      // Функция для обработки ввода реферального кода
      const handleReferralInput = async (msg) => {
        if (waitingForReferralCode.has(chatId) && msg.chat.id === chatId && msg.text) {
          const referralCode = msg.text.trim();

          if (referralCode) {
            // Проверяем, существует ли реферальный код и не введен ли он уже
            const referrer = await UserModel.findOne({ telegramId: referralCode });

            if (referrer && referrer.telegramId !== telegramId) {
              // Обновляем реферальный код пользователя
              await UserModel.updateOne({ telegramId }, { refCode: referrer.telegramId });
              bot.sendMessage(chatId, 'Реферальный код успешно введен!');
              waitingForReferralCode.delete(chatId); // Удаляем состояние ожидания
              bot.removeListener('message', handleReferralInput); // Удаляем обработчик после успешного ввода
              delete referralInputHandlers[chatId];
            } else {
              bot.sendMessage(
                chatId,
                'Вы ввели неправильный реферальный код, возможно такого пользователя не существует. Попробуйте еще раз...',
              );
            }
          } else {
            bot.sendMessage(chatId, 'Реферальный код не может быть пустым. Попробуйте еще раз...');
          }
        }
      };

      // Устанавливаем обработчик ввода реферального кода
      referralInputHandlers[chatId] = handleReferralInput;
      bot.on('message', handleReferralInput);
    } else {
      bot.sendMessage(chatId, 'Пользователь не найден.');
    }
  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}
