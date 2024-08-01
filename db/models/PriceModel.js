import mongoose from 'mongoose';

const priceSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  currency: {
    type: Number,
    default: 840,
  },
});

const PriceModel = mongoose.model('Price', priceSchema);

export default PriceModel;
