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

  async generateAnswer(question: string, context: string) {
    const prompt = `
Respondé usando únicamente el contexto proporcionado.
Si la respuesta no está en el contexto, decí: "No encontré esa información en el documento."

Contexto:
${context}

Pregunta:
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
