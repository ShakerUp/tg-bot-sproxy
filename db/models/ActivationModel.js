import mongoose from 'mongoose';

const activationSchema = new mongoose.Schema(
  {
    referrerTelegramId: {
      type: String,
      required: true,
    },
    activatedUserId: {
      type: String,
      required: true,
      unique: true,
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    activatedUsername: {
      type: String,
      default: 'Unknown', 
    },
  },
  { timestamps: true },
);

const ActivationModel = mongoose.model('Activation', activationSchema);

export default ActivationModel;
