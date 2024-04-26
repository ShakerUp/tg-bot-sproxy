import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      unique: true,
    },
    telegramId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  { timestamps: true },
);

// Создание модели пользователя
const UserModel = mongoose.model('User', userSchema);

export default UserModel;
