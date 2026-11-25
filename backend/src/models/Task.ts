import mongoose, { Document, Schema } from 'mongoose';

export interface ITaskStep {
  _id?: mongoose.Types.ObjectId;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
  estimatedMinutes?: number;
  position: number;
}

export type TaskState =
  | 'CAPTURED' | 'PLANNED' | 'READY_TO_START' | 'FOCUSING'
  | 'PAUSED' | 'STALLED' | 'RECOVERY' | 'TRANSITIONING'
  | 'COMPLETED' | 'PROCESSING_FAILED' | 'CANCELLED' | 'IN_PROGRESS';

export interface ITask extends Document {
  userId: mongoose.Types.ObjectId;
  projectId?: string;
  title: string;
  notes?: string;
  state: TaskState;
  previousState?: TaskState;
  plannedMinutes: number;
  actualMinutes: number;
  priority: 'low' | 'medium' | 'high';
  isToday: boolean;
  steps: ITaskStep[];
  lastStalledReason?: string;
  suggestedNextAction?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskStepSchema = new Schema<ITaskStep>(
  {
    title: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    isCurrent: { type: Boolean, default: false },
    estimatedMinutes: { type: Number },
    position: { type: Number, default: 0 },
  },
  { _id: true }
);

const TaskSchema = new Schema<ITask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: String },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    state: {
      type: String,
      enum: ['CAPTURED','PLANNED','READY_TO_START','FOCUSING','PAUSED','STALLED',
             'RECOVERY','TRANSITIONING','COMPLETED','PROCESSING_FAILED','CANCELLED','IN_PROGRESS'],
      default: 'CAPTURED',
    },
    previousState: {
      type: String,
      enum: ['CAPTURED','PLANNED','READY_TO_START','FOCUSING','PAUSED','STALLED',
             'RECOVERY','TRANSITIONING','COMPLETED','PROCESSING_FAILED','CANCELLED','IN_PROGRESS'],
    },
    plannedMinutes: { type: Number, default: 20 },
    actualMinutes: { type: Number, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    isToday: { type: Boolean, default: true },
    steps: [TaskStepSchema],
    lastStalledReason: { type: String },
    suggestedNextAction: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

TaskSchema.index({ userId: 1, createdAt: -1 });
TaskSchema.index({ userId: 1, isToday: 1 });

export default mongoose.model<ITask>('Task', TaskSchema);
