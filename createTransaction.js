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
    } else {
      // Если ответ не 200, бросаем ошибку
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
      },
    });

    const transaction = await TransactionModel.findOneAndUpdate(
      { invoiceId },
      { $set: { status: response.data.status, updatedAt: new Date() } },
      { new: true }, // Возвращает обновленный объект
    );

    if (!transaction) {
      throw new Error('Транзакция не найдена');
    }

    if (transaction.status === 'success') {
      const existingTopUp = await BalanceTopUpModel.findOne({ transactionId: transaction._id });
      if (!existingTopUp) {
        const updatedUser = await UserModel.findByIdAndUpdate(
          transaction.userId,
          { $inc: { balance: transaction.amount / 100 } },
          { new: true },
        );
        await BalanceTopUpModel.create({
          userId: transaction.userId,
          transactionId: transaction._id,
          amount: transaction.amount,
          currency: transaction.currency,
        });
      }
    }

    return transaction;
  } catch (error) {
    console.error('Ошибка при обновлении статуса транзакции:', error.message);
    throw new Error('Ошибка при обновлении статуса транзакции');
  }
};

export const getTransactionsByTelegramId = async (transactions) => {
  try {
    const updatePromises = transactions
      .filter((transaction) => ['created', 'success'].includes(transaction.status))
      .map((transaction) => updateTransactionStatus(transaction.invoiceId));

    await Promise.all(updatePromises);

    return transactions;
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error.message);
    throw new Error('Ошибка при получении транзакций');
  }
};
