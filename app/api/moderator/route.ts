
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { MODERATOR_SYSTEM_PROMPT, MODELS } from '@/app/lib/constants';

export const maxDuration = 60;

export async function POST(req: Request) {
    const { messages, modelId } = await req.json();

    // Moderator uses the selected model, defaulting to GPT-5.1 if not provided
    const modelInfo = MODELS.find((m) => m.id === modelId) || MODELS[0];

    let model;
    switch (modelInfo.provider) {
        case 'openai':
            model = openai(modelInfo.id);
            break;
        case 'anthropic':
            model = anthropic(modelInfo.id);
            break;
        case 'google':
            model = google(modelInfo.id);
            break;
        default:
            model = openai('gpt-4o');
    }

    // Filter out empty messages and convert to core format
    const filteredMessages = messages
        .filter((msg: any) => msg.content && msg.content.trim() !== '')
        .map((msg: any) => ({
            role: msg.role,
            content: msg.content
        }));

    const result = await streamText({
        model,
        system: MODERATOR_SYSTEM_PROMPT,
        messages: filteredMessages,
    });

    return result.toTextStreamResponse();
}
