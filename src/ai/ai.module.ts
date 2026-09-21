import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeminiTransportParser } from './parsers/gemini-transport.parser';
import { OpenAITransportParser } from './parsers/openai-transport.parser';

@Module({
  providers: [OpenAITransportParser, GeminiTransportParser, AiService],
  exports: [AiService],
})
export class AiModule {}
