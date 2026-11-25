import mongoose, { Document, Schema } from 'mongoose';

export interface IFocusRoomParticipant {
  participantId: string;
  name: string;
  avatar: string;
  status: 'focusing' | 'paused' | 'break';
  taskDisplay: string;
  isPrivate: boolean;
  joinedAt: Date;
}

export interface IFocusRoom extends Document {
  roomCode: string;
  participants: IFocusRoomParticipant[];
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FocusRoomParticipantSchema = new Schema<IFocusRoomParticipant>(
  {
    participantId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: '🎯' },
    status: { type: String, enum: ['focusing', 'paused', 'break'], default: 'focusing' },
    taskDisplay: { type: String, default: 'Focused Deep Work' },
    isPrivate: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FocusRoomSchema = new Schema<IFocusRoom>(
  {
    roomCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    participants: [FocusRoomParticipantSchema],
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FocusRoomSchema.index({ isActive: 1, lastActiveAt: -1 });

export default mongoose.model<IFocusRoom>('FocusRoom', FocusRoomSchema);
