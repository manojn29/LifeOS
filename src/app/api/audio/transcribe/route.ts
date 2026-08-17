import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('file') as Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const settings = await dbRepo.getSettings(user.id);
    const groqKey = (settings.groq_api_key || process.env.GROQ_API_KEY || '').trim();
    const openaiKey = (settings.openai_api_key || process.env.OPENAI_API_KEY || '').trim();
    const geminiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();

    // 1. Try Groq Whisper (Ultra-fast whisper-large-v3-turbo, 100% free)
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        const mimeType = audioFile.type || 'audio/webm';
        const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
        
        // Re-wrap blob with a filename so form-data multipart parser sees it as a file
        groqFormData.append('file', audioFile, `recording.${extension}`);
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('response_format', 'json');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqFormData,
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          if (data.text && data.text.trim()) {
            return NextResponse.json({ text: data.text.trim(), provider: 'groq-whisper' });
          }
        } else {
          const errText = await groqRes.text();
          console.warn('Groq Whisper API response not ok:', groqRes.status, errText);
        }
      } catch (groqErr) {
        console.warn('Groq Whisper error, attempting fallback:', groqErr);
      }
    }

    // 2. Try OpenAI Whisper (if user has OpenAI key)
    if (openaiKey) {
      try {
        const openaiFormData = new FormData();
        openaiFormData.append('file', audioFile, 'recording.webm');
        openaiFormData.append('model', 'whisper-1');
        openaiFormData.append('response_format', 'json');

        const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
          body: openaiFormData,
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          if (data.text && data.text.trim()) {
            return NextResponse.json({ text: data.text.trim(), provider: 'openai-whisper' });
          }
        }
      } catch (openaiErr) {
        console.warn('OpenAI Whisper error, attempting fallback:', openaiErr);
      }
    }

    // 3. Try Gemini Multimodal Audio Transcription (Free tier Gemini)
    if (geminiKey) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = audioFile.type || 'audio/webm';

        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType.split(';')[0], // strip codecs like audio/webm;codecs=opus
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transcribe this spoken audio exactly as spoken into plain text with accurate capitalization and punctuation. Return ONLY the transcribed text with no explanations, preface, or extra markdown.',
                },
              ],
            },
          ],
        });

        const text = response.text?.trim();
        if (text) {
          return NextResponse.json({ text, provider: 'gemini-audio' });
        }
      } catch (geminiErr) {
        console.warn('Gemini audio transcription error:', geminiErr);
      }
    }

    // 4. If no AI keys configured or all failed
    return NextResponse.json(
      {
        error:
          'Could not transcribe audio. Please configure a free Groq or Gemini API key in Settings.',
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
