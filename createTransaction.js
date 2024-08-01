import axios from 'axios';

import TransactionModel from './db/models/TransactionModel.js';
import BalanceTopUpModel from './db/models/BalanceTopUpModel.js';
import UserModel from './db/models/UserModel.js';

export const createTransaction = async (
  userId,
  telegramId,
  amount,
  currency,
  validity,
  reference,
  destination,
) => {
  try {
    const apiUrl = 'https://api.monobank.ua/api/merchant/invoice/create';
    const requestBody = JSON.stringify({
      amount,
      ccy: currency,
      validity,
      merchantPaymInfo: { reference, destination },
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'x-token': process.env.MONOBANK_API_TOKEN,
      },
    });

    if (response.status === 200) {
      // Создаем новую транзакцию
      const transaction = await TransactionModel.create({
        userId,
        telegramId,
        amount,
        currency,
        validity,
        reference,
        destination,
        invoiceId: response.data.invoiceId,
        pageUrl: response.data.pageUrl,
      });

      return transaction;
    }
    if (response.status === 403) {
      // Создаем новую транзакцию
      console.log(response.data);
    } else {
      // Если ответ не 200, бросаем ошибку
      console.log(response.data);
      throw new Error('Ошибка при создании транзакции');
    }
  } catch (error) {
    console.error('Ошибка при создании транзакции:', error.message);
    throw new Error('Ошибка при создании транзакции');
  }
};

export const updateTransactionStatus = async (invoiceId) => {
  try {
    const apiUrl = `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${invoiceId}`;
    const response = await axios.get(apiUrl, {
      headers: {
        'x-token': process.env.MONOBANK_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log(process.env.MONOBANK_API_TOKEN);

    let transaction;
    try {
      transaction = await TransactionModel.findOneAndUpdate(
        { invoiceId },
        { $set: { status: response.data.status, updatedAt: new Date() } },
        { new: true }, // Возвращает обновленный объект
      );
    } catch (error) {
      console.error('Ошибка при обновлении транзакции:', error.message);
      throw new Error('Ошибка при обновлении транзакции в базе данных');
    }

    if (!transaction) {
      throw new Error('Транзакция не найдена');
    }

    if (transaction.status === 'success') {
      try {
        const existingTopUp = await BalanceTopUpModel.findOne({ transactionId: transaction._id });
        if (!existingTopUp) {
          const updatedUser = await UserModel.findByIdAndUpdate(
            transaction.userId,
            { $inc: { balance: transaction.amount / 100 } },
            { new: true },
          );

          // Проверка наличия реферального кода
          if (updatedUser.refCode) {
            const referrer = await UserModel.findOne({ telegramId: updatedUser.refCode });

            if (referrer) {
              const referralBonus = (transaction.amount / 100) * 0.1; // 10% бонус

              // Обновление баланса реферала
              await UserModel.findByIdAndUpdate(
                referrer._id,
                { $inc: { balance: referralBonus, refEarnings: referralBonus } },
                { new: true },
              );
            }
          }

          await BalanceTopUpModel.create({
            userId: transaction.userId,
            transactionId: transaction._id,
            amount: transaction.amount,
            currency: transaction.currency,
            refCode: updatedUser.refCode || null, // Сохранение реферального кода
          });

          console.log('Balance top-up created for user:', transaction.userId);
        }
      } catch (error) {
        console.error('Ошибка при обновлении баланса или создании топ-апа:', error.message);
        throw new Error('Ошибка при обновлении баланса или создании топ-апа');
      }
    } else if (transaction.status === 'reversed') {
      try {
        // Если транзакция отменена, удаляем запись о пополнении баланса
        const existingTopUp = await BalanceTopUpModel.findOneAndDelete({
          transactionId: transaction._id,
        });

        if (existingTopUp) {
          const updatedUser = await UserModel.findByIdAndUpdate(
            transaction.userId,
            { $inc: { balance: -existingTopUp.amount / 100 } },
            { new: true },
          );
        }
      } catch (error) {
        console.error('Ошибка при отмене топ-апа:', error.message);
        throw new Error('Ошибка при отмене топ-апа');
      }
    }

    return transaction;
  } catch (error) {
    console.error('Ошибка при обновлении статуса транзакции:', invoiceId);
    console.error('Ошибка:', error.message);
    throw new Error('Ошибка при обновлении статуса транзакции');
  }
};

export const getTransactionsByTelegramId = async (transactions) => {
  try {
    const updatePromises = transactions
      .filter((transaction) => ['created', 'success', 'reversed'].includes(transaction.status))
      .map((transaction) => updateTransactionStatus(transaction.invoiceId));

    await Promise.all(updatePromises);

    return transactions;
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error.message);
    throw new Error('Ошибка при получении транзакций');
  }
};
