import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AskDocumentDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsBoolean()
  useHistory?: boolean;
}