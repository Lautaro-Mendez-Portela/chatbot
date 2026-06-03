import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DocumentsService } from './documents.service';

import { Body, Param } from '@nestjs/common';
import { AskDocumentDto } from './dto/ask-document.dto';
import { Delete, Get } from '@nestjs/common';

@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',

        filename: (req, file, callback) => {
          const uniqueName = Date.now() + extname(file.originalname);

          callback(null, uniqueName);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: any,
  ) {
    const text = await this.documentsService.extractText(file.path);

    return this.documentsService.createDocument({
      title: file.originalname,
      filename: file.filename,
      path: file.path,
      content: text,
      userId: user.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getMyDocuments(@GetUser() user: any) {
    return this.documentsService.findMyDocuments(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getDocumentById(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.findOneByUser(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteDocument(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.deleteDocument(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/ask')
  askDocument(
    @Param('id') id: string,
    @Body() dto: AskDocumentDto,
    @GetUser() user: any,
  ) {
    return this.documentsService.findRelevantChunks(
      id,
      dto.question,
      user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getMessages(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.getMessages(id, user.userId);
  }
}
