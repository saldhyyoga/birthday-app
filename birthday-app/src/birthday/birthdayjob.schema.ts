import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BirthdayJobDocument = BirthdayJob & Document;

@Schema({ timestamps: true })
export class BirthdayJob extends Document {
  @Prop({ required: true })
  userId: Types.ObjectId; // keep reference so we know which user

  @Prop({ required: true })
  userName: string; // snapshot

  @Prop({ required: true })
  userEmail: string; // snapshot

  @Prop({ required: true })
  birthday: Date; // original birthday

  @Prop({ required: true })
  timezone: string; // user timezone at the time we generated

  @Prop({ required: true })
  sendBirthdayAt: Date;
  // the UTC time we should actually send (00:00 local user time converted to UTC)

  @Prop({ default: false })
  sent: boolean;

  @Prop()
  sentAt?: Date;

  @Prop({ default: 0 })
  attempts: number;
}

export const BirthdayJobSchema = SchemaFactory.createForClass(BirthdayJob);
