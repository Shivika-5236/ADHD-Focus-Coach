import mongoose, { Document, Schema } from 'mongoose';

export interface ICoachingDigest extends Document {
  userId: mongoose.Types.ObjectId;
  headline: string;
  strengths: string[];
  watchOuts: string[];
  nextExperiment: string;
  signature: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CoachingDigestSchema = new Schema<ICoachingDigest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, required: true, trim: true },
    strengths: [{ type: String, trim: true }],
    watchOuts: [{ type: String, trim: true }],
    nextExperiment: { type: String, required: true, trim: true },
    signature: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<ICoachingDigest>('CoachingDigest', CoachingDigestSchema);
