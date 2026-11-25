import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface IFocusSession extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: string;
  taskTitle?: string;
  status: SessionStatus;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes: number;
  plannedMinutes: number;
  completed: boolean;
  completedStepsCount: number;
  totalStepsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const FocusSessionSchema = new Schema<IFocusSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: String, required: true },
    taskTitle: { type: String },
    status: {
      type: String,
      enum: ['PLANNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    plannedMinutes: { type: Number, default: 25 },
    completed: { type: Boolean, default: false },
    completedStepsCount: { type: Number, default: 0 },
    totalStepsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FocusSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IFocusSession>('FocusSession', FocusSessionSchema);
