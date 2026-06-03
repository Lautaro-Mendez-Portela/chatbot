import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AiService {
  async createEmbedding(text: string) {
    const response = await axios.post('http://localhost:11434/api/embeddings', {
      model: 'nomic-embed-text',
      prompt: text,
    });

    return response.data.embedding;
  }

  async generateAnswer(question: string, context: string, chatHistory = '') {
    const prompt = `
      Respondé usando principalmente el contexto del documento.
      También podés usar el historial de conversación para entender referencias como "eso", "lo anterior" o "esa parte".

      Si la respuesta no está en el contexto del documento, decí:
      "No encontré esa información en el documento."

      Historial de conversación:
      ${chatHistory}

      Contexto del documento:
      ${context}

      Pregunta actual:
      ${question}
      `;

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2',
      prompt,
      stream: false,
    });

    return response.data.response;
  }
}
