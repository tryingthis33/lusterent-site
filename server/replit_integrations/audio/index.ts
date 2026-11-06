export { registerAudioRoutes } from "./routes";
export {
  openai,
  getOpenAI,
  AiIntegrationUnavailableError,
  detectAudioFormat,
  convertToWav,
  ensureCompatibleFormat,
  type AudioFormat,
  voiceChat,
  voiceChatStream,
  textToSpeech,
  textToSpeechStream,
  speechToText,
  speechToTextStream,
} from "./client";
