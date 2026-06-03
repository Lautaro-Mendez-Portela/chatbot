import { IsString } from 'class-validator';

export class AskDocumentDto {
  @IsString()
  question!: string;
}