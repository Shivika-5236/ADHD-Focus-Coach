import mongoose, { Document, Schema } from 'mongoose';

export interface IChatAction {
  type: string;
  label?: string;
  executed?: boolean;
  data?: Record<string, unknown>;
}

export interface IChatMessage extends Document {
  userId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  action?: IChatAction;
  createdAt: Date;
  updatedAt: Date;
}

const ChatActionSchema = new Schema<IChatAction>(
  {
    type: { type: String, required: true },
    label: { type: String },
    executed: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    action: { type: ChatActionSchema },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ userId: 1, createdAt: 1 });

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
