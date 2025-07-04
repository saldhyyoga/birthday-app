import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  birthday: Date;

  @Prop({ required: true })
  timezone: string;

  @Prop({ required: true })
  nextBirthdayAtUtc: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
