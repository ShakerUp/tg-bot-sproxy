import mongoose from 'mongoose';

const balanceTopUpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Ссылка на модель пользователя
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction', // Ссылка на модель транзакции
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const BalanceTopUpModel = mongoose.model('BalanceTopUp', balanceTopUpSchema);

export default BalanceTopUpModel;
