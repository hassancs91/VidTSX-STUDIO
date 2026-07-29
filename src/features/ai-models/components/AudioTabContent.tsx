import { SectionHeader } from '@shared/components';
import { isFeatureEnabled } from '@shared/feature-flags';
import { AudioModelsContent } from './AudioModelsContent';
import { WhisperModelsSection } from './WhisperModelsSection';

export function AudioTabContent() {
  // The sherpa-onnx voice engine (TTS + live STT) isn't bundled in production
  // builds yet — hide its section so users can't download models they can't
  // run. Whisper (captions/transcription) is fully supported and stays first.
  const showVoiceEngine = isFeatureEnabled('audio-engine');

  return (
    <div>
      <SectionHeader>Transcription (whisper.cpp)</SectionHeader>
      <p className="text-[11px] text-text-muted -mt-2 mb-3">
        Generates timestamped transcripts used for the Transcribe tool, captions,
        and subtitle export.
      </p>
      <WhisperModelsSection />

      {showVoiceEngine && (
        <div className="mt-8 pt-6" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <SectionHeader>Voice Engine (TTS &amp; live speech-to-text)</SectionHeader>
          <p className="text-[11px] text-text-muted -mt-2 mb-3">
            Models for the built-in voice engine — text-to-speech and real-time transcription.
          </p>
          <AudioModelsContent />
        </div>
      )}
    </div>
  );
}
