import mongoose from 'mongoose';

const proxySchema = new mongoose.Schema(
  {
    hostIp: {
      type: String,
      required: true,
    },
    socksPort: {
      type: Number,
      required: true,
      unique: true,
    },
    httpPort: {
      type: Number,
      required: true,
      unique: true,
    },
    login: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      unique: true,
    },
    changeIpUrl: {
      type: String,
      required: true,
      unique: true,
    },
    isFree: {
      type: Boolean,
      required: true,
    },
    expirationDate: {
      type: Date,
    },
    userTelegramId: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// Создание модели пользователя
const ProxyModel = mongoose.model('Proxy', proxySchema);

export default ProxyModel;
