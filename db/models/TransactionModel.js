// transactions.js

import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Ссылка на модель пользователя
      required: true,
    },
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    telegramId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    validity: {
      type: Number,
      required: true,
      default: 120,
    },
    status: {
      type: String,
      enum: ['created', 'processing', 'success', 'failure', 'reversed', 'expired'],
      default: 'created',
    },
    pageUrl: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    reference: {
      type: String,
    },
    destination: {
      type: String,
    },
    paymentInfo: {
      // Дополнительная информация о платеже от MonoBank API
      type: Object,
    },
    walletData: {
      // Параметры карты
      type: Object,
    },
  },
  { timestamps: true },
);

const TransactionModel = mongoose.model('Transaction', transactionSchema);

export default TransactionModel;
