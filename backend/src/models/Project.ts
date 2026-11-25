import mongoose, { Document, Schema } from 'mongoose';

export interface IMilestone {
  _id?: mongoose.Types.ObjectId;
  title: string;
  order: number;
  taskIds: string[];
  isNextActionable: boolean;
}

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  color: string;
  milestones: IMilestone[];
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    taskIds: [{ type: String }],
    isNextActionable: { type: Boolean, default: false },
  },
  { _id: true }
);

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#10b981' },
    milestones: [MilestoneSchema],
  },
  { timestamps: true }
);

ProjectSchema.index({ userId: 1 });

export default mongoose.model<IProject>('Project', ProjectSchema);
