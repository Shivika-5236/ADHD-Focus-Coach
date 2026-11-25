import mongoose, { Document, Schema } from 'mongoose';

export type ThemePreference = 'Light' | 'Dark' | 'System';

export interface IUserPreferences {
  theme: ThemePreference;
  focusTimerDefault: string;
  notifications: boolean;
  sound: boolean;
  autoStartNextStep: boolean;
  showDailyTips: boolean;
}

export const DEFAULT_USER_PREFERENCES: IUserPreferences = {
  theme: 'Light',
  focusTimerDefault: '25 minutes',
  notifications: true,
  sound: true,
  autoStartNextStep: false,
  showDailyTips: true,
};

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    theme: { type: String, enum: ['Light', 'Dark', 'System'], default: 'Light' },
    focusTimerDefault: { type: String, default: '25 minutes' },
    notifications: { type: Boolean, default: true },
    sound: { type: Boolean, default: true },
    autoStartNextStep: { type: Boolean, default: false },
    showDailyTips: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({ ...DEFAULT_USER_PREFERENCES }),
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
