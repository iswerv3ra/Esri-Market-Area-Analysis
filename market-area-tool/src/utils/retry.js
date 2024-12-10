// src/utils/retry.js

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const withRetry = async (operation, retries = MAX_RETRIES, delay = RETRY_DELAY) => {
  try {
    return await operation();
  } catch (error) {
    if (retries === 0 || error?.response?.status !== 500) {
      throw error;
    }

    console.log(`Retrying operation, ${retries} attempts remaining...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 1.5);
  }
};