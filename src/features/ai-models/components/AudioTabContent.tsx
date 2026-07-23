import { SectionHeader } from '@shared/components';
import { AudioModelsContent } from './AudioModelsContent';
import { WhisperModelsSection } from './WhisperModelsSection';

export function AudioTabContent() {
  return (
    <div>
      <SectionHeader>Voice Engine (TTS &amp; live speech-to-text)</SectionHeader>
      <p className="text-[11px] text-text-muted -mt-2 mb-3">
        Models for the built-in voice engine — text-to-speech and real-time transcription.
      </p>
      <AudioModelsContent />

      <div className="mt-8 pt-6" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <SectionHeader>Captions &amp; Transcription (whisper.cpp)</SectionHeader>
        <p className="text-[11px] text-text-muted -mt-2 mb-3">
          Generates timestamped transcripts used for captions and subtitle export.
        </p>
        <WhisperModelsSection />
      </div>
    </div>
  );
}
