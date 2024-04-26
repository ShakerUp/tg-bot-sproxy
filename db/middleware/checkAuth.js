import UserModel from '../models/UserModel.js';

const checkAuth = async (telegramId, requiredRoles) => {
  try {
    const user = await UserModel.findOne({ telegramId });
    if (!user) {
      return false;
    }

    if (!requiredRoles.includes(user.role)) {
      return false;
    }
    return { permission: true, user };
  } catch (err) {
    console.error('Ошибка:', err.message);
    return false;
  }
};

export default checkAuth;
