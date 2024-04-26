export const formatAmount = (amount) => {
  const formattedAmount = (amount / 100).toFixed(1);
  return `${formattedAmount}$`;
};
