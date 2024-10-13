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
      unique: true,
      default: 'You dont have a username',
    },
    firstName: {
      type: String,
      default: 'You dont have a first name',
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'traf'],
      default: 'user',
    },
    refCode: {
      type: String,
      unique: true,
      default: '',
    },
    refEarnings: {
      type: Number,
      default: 0,
    },
    refBonusAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const UserModel = mongoose.model('User', userSchema);

export default UserModel;
