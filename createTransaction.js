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

const fetchTransactionStatus = async (invoiceId) => {
  try {
    const response = await axios.get(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${invoiceId}`,
      {
        headers: {
          'x-token': process.env.MONOBANK_API_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Ошибка при запросе статуса транзакции:', invoiceId, error.message);
    throw new Error('Ошибка при запросе статуса транзакции');
  }
};

const updateTransactionStatus = async (invoiceId) => {
  try {
    // Получаем текущий статус транзакции из базы данных
    const transaction = await TransactionModel.findOne({ invoiceId });
    if (!transaction) {
      throw new Error('Транзакция не найдена в базе данных');
    }

    // Пропускаем запрос, если статус уже expired
    if (transaction.status === 'expired') {
      console.log(`Транзакция ${invoiceId} уже имеет статус expired. Запрос не требуется.`);
      return transaction;
    }

    // Запрашиваем новый статус
    const statusData = await fetchTransactionStatus(invoiceId);

    // Обновляем статус транзакции в базе данных
    const updatedTransaction = await TransactionModel.findOneAndUpdate(
      { invoiceId },
      { $set: { status: statusData.status, updatedAt: new Date() } },
      { new: true },
    );

    if (!updatedTransaction) {
      throw new Error('Транзакция не найдена после обновления');
    }

    if (updatedTransaction.status === 'success') {
      await handleSuccessTransaction(updatedTransaction);
    } else if (updatedTransaction.status === 'reversed') {
      await handleReversedTransaction(updatedTransaction);
    }

    return updatedTransaction;
  } catch (error) {
    console.error('Ошибка при обновлении статуса транзакции:', invoiceId, error.message);
    throw new Error('Ошибка при обновлении статуса транзакции');
  }
};

const handleSuccessTransaction = async (transaction) => {
  try {
    const existingTopUp = await BalanceTopUpModel.findOne({ transactionId: transaction._id });

    if (!existingTopUp) {
      const updatedUser = await UserModel.findByIdAndUpdate(
        transaction.userId,
        { $inc: { balance: transaction.amount / 100 } },
        { new: true },
      );

      if (updatedUser.refCode) {
        const referrer = await UserModel.findOne({ telegramId: updatedUser.refCode });
        if (referrer) {
          const referralBonus = (transaction.amount / 100) * 0.1; // 10% бонус
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
        refCode: updatedUser.refCode || null,
      });

      console.log('Balance top-up created for user:', transaction.userId);
    }
  } catch (error) {
    console.error('Ошибка при обработке успешной транзакции:', error.message);
    throw new Error('Ошибка при обработке успешной транзакции');
  }
};

const handleReversedTransaction = async (transaction) => {
  try {
    const existingTopUp = await BalanceTopUpModel.findOneAndDelete({
      transactionId: transaction._id,
    });

    if (existingTopUp) {
      await UserModel.findByIdAndUpdate(
        transaction.userId,
        { $inc: { balance: -existingTopUp.amount / 100 } },
        { new: true },
      );
    }
  } catch (error) {
    console.error('Ошибка при отмене топ-апа:', error.message);
    throw new Error('Ошибка при отмене топ-апа');
  }
};

export const getTransactionsByTelegramId = async (transactions) => {
  try {
    const invoiceIds = transactions
      .filter((transaction) => ['created', 'success', 'reversed'].includes(transaction.status))
      .map((transaction) => transaction.invoiceId);

    const updatePromises = invoiceIds.map((invoiceId) => updateTransactionStatus(invoiceId));
    await Promise.all(updatePromises);

    return transactions;
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error.message);
    throw new Error('Ошибка при получении транзакций');
  }
};
