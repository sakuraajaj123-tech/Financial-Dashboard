import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Converts any audio Blob (e.g. WebM/Opus recorded by MediaRecorder) into a standard MP3 Blob
 * compatible with WhatsApp Meta Cloud API and all mobile/desktop browsers.
 *
 * @param {Blob} audioBlob - The recorded audio blob from MediaRecorder
 * @returns {Promise<Blob>} - Standard MP3 audio blob (MIME: audio/mp3)
 */
export async function convertBlobToMp3(audioBlob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    console.warn('[AudioEncoder] Web Audio API not supported, returning original blob.');
    return audioBlob;
  }

  const audioContext = new AudioCtx();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    // Encode to 128kbps MP3
    const encoder = new Mp3Encoder(numChannels >= 2 ? 2 : 1, sampleRate, 128);

    const mp3Chunks = [];
    const sampleBlockSize = 1152;

    if (numChannels >= 2) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      const int16Left = new Int16Array(left.length);
      const int16Right = new Int16Array(right.length);
      for (let i = 0; i < left.length; i++) {
        const sL = Math.max(-1, Math.min(1, left[i]));
        int16Left[i] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
        const sR = Math.max(-1, Math.min(1, right[i]));
        int16Right[i] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
      }

      for (let i = 0; i < int16Left.length; i += sampleBlockSize) {
        const chunkL = int16Left.subarray(i, i + sampleBlockSize);
        const chunkR = int16Right.subarray(i, i + sampleBlockSize);
        const mp3buf = encoder.encodeBuffer(chunkL, chunkR);
        if (mp3buf.length > 0) {
          mp3Chunks.push(mp3buf);
        }
      }
    } else {
      const samples = audioBuffer.getChannelData(0);
      const int16Samples = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
        const chunk = int16Samples.subarray(i, i + sampleBlockSize);
        const mp3buf = encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) {
          mp3Chunks.push(mp3buf);
        }
      }
    }

    const endBuf = encoder.flush();
    if (endBuf.length > 0) {
      mp3Chunks.push(endBuf);
    }

    return new Blob(mp3Chunks, { type: 'audio/mp3' });
  } catch (err) {
    console.warn('[AudioEncoder] Conversion to MP3 failed, falling back to original blob:', err);
    return audioBlob;
  } finally {
    audioContext.close().catch(() => {});
  }
}
