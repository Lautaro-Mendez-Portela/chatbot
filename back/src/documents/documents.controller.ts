import {
  BadRequestException,
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
import { Delete, Get, Patch } from '@nestjs/common';

const MAX_PDF_SIZE = 15 * 1024 * 1024;

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
      fileFilter: (req, file, callback) => {
        const isPdf =
          file.mimetype === 'application/pdf' &&
          extname(file.originalname).toLowerCase() === '.pdf';

        if (!isPdf) {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }

        callback(null, true);
      },
      limits: {
        fileSize: MAX_PDF_SIZE,
      },
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
  @Post(':id/chats')
  createChat(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.createChat(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/chats')
  getChats(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.getChats(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/chats/:chatId')
  updateChat(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Body('title') title: string,
    @GetUser() user: any,
  ) {
    return this.documentsService.updateChat(id, chatId, user.userId, title);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/chats/:chatId')
  deleteChat(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @GetUser() user: any,
  ) {
    return this.documentsService.deleteChat(id, chatId, user.userId);
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
      dto.useHistory ?? true,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/chats/:chatId/ask')
  askDocumentChat(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Body() dto: AskDocumentDto,
    @GetUser() user: any,
  ) {
    return this.documentsService.findRelevantChunks(
      id,
      dto.question,
      user.userId,
      dto.useHistory ?? true,
      chatId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getMessages(@Param('id') id: string, @GetUser() user: any) {
    return this.documentsService.getMessages(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/chats/:chatId/messages')
  getChatMessages(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @GetUser() user: any,
  ) {
    return this.documentsService.getMessages(id, user.userId, chatId);
  }
}
