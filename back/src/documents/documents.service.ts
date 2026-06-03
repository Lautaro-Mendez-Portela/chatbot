import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { AiService } from '../ai/ai.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  private splitTextIntoChunks(text: string, chunkSize = 1200) {
    const chunks: string[] = [];

    const cleanText = text.trim();

    for (let i = 0; i < cleanText.length; i += chunkSize) {
      const chunk = cleanText.slice(i, i + chunkSize).trim();

      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  async extractText(filePath: string) {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
      const data = await parser.getText();
      return data.text;
    } finally {
      await parser.destroy();
    }
  }

  async createDocument(data: {
    title: string;
    filename: string;
    path: string;
    content: string;
    userId: string;
  }) {
    const chunks = this.splitTextIntoChunks(data.content);

    return this.prisma.document.create({
      data: {
        title: data.title,
        filename: data.filename,
        path: data.path,
        content: data.content,
        userId: data.userId,
        chunks: {
          create: await Promise.all(
            chunks.map(async (chunk, index) => ({
              content: chunk,
              position: index,
              embedding: await this.aiService.createEmbedding(chunk),
            })),
          ),
        },
      },
      include: {
        chunks: true,
      },
    });
  }

  private cosineSimilarity(a: number[], b: number[]) {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findRelevantChunks(
    documentId: string,
    question: string,
    userId: string,
    useHistory = true,
  ) {
    const questionEmbedding = await this.aiService.createEmbedding(question);

    const chunks = await this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { position: 'asc' },
    });

    const rankedChunks = chunks
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        position: chunk.position,
        score: this.cosineSimilarity(
          questionEmbedding,
          (chunk as any).embedding as number[],
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const context = rankedChunks
      .map((chunk) => chunk.content)
      .join('\n\n---\n\n');

    const chatHistory = useHistory
      ? await this.getChatHistoryContext(documentId, userId)
      : '';

    const answer = await this.aiService.generateAnswer(
      question,
      context,
      chatHistory,
    );

    await this.saveChatMessage({
      question,
      answer,
      userId,
      documentId,
    });

    return {
      answer,
      question,
      sources: rankedChunks,
      userId,
      documentId,
    };
  }

  async findMyDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        filename: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneByUser(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          select: {
            id: true,
            position: true,
            content: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenException('You cannot access this document');
    }

    return document;
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenException('You cannot delete this document');
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    try {
      await fs.promises.unlink(document.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return {
      message: 'Document deleted successfully',
    };
  }

  async saveChatMessage(data: {
    question: string;
    answer: string;
    userId: string;
    documentId: string;
  }) {
    return this.prisma.chatMessage.create({
      data,
    });
  }

  async getMessages(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenException('You cannot access this document');
    }

    return this.prisma.chatMessage.findMany({
      where: {
        documentId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private async getChatHistoryContext(documentId: string, userId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        documentId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 6,
    });

    return messages
      .reverse()
      .map(
        (message) =>
          `Usuario: ${message.question}\nAsistente: ${message.answer}`,
      )
      .join('\n\n');
  }
}
