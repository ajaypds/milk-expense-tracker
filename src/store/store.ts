import { configureStore } from '@reduxjs/toolkit';
import settingsReducer from './settingsSlice';
import milkReducer from './milkSlice';

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    milk: milkReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
