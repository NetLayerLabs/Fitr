// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "@/lib/i18n";
import { setActiveMessages } from "@/lib/i18n/translate";
import { en } from "@/lib/i18n/messages";
import { speechTranslator, VoiceCoach } from "@/components/workout/voiceCoach";
import { speak, speechLocale } from "../bridge";

type Native = NonNullable<Window["FitrNative"]>;

function native(extra: Partial<Native> = {}): Native {
  return {
    version: () => "1.2.0",
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    notificationPermission: () => "default",
    requestNotificationPermission: vi.fn(),
    scheduleReminders: vi.fn(),
    cancelReminders: vi.fn(),
    updateWidget: vi.fn(),
    ...extra,
  };
}

afterEach(() => {
  delete window.FitrNative;
  setActiveMessages("en", en);
});

describe("speechLocale", () => {
  it("is English by default", () => {
    expect(speechLocale()).toBe("en");
  });

  it("follows the app language in a browser (Web Speech gets the lang tag)", () => {
    setActiveMessages("fr", en);
    expect(speechLocale()).toBe("fr");
  });

  it("falls back to English on an APK without setSpeechLanguage", () => {
    window.FitrNative = native();
    setActiveMessages("ja", en);
    expect(speechLocale()).toBe("en");
  });

  it("switches the native voice and speaks the app language when the device has a voice", () => {
    const setSpeechLanguage = vi.fn(() => true);
    window.FitrNative = native({ setSpeechLanguage });
    setActiveMessages("de", en);
    expect(speechLocale()).toBe("de");
    speak("Los.");
    expect(setSpeechLanguage).toHaveBeenCalledTimes(1);
    expect(setSpeechLanguage).toHaveBeenCalledWith("de-DE");
  });

  it("speaks English when the device has no voice for the app language", () => {
    const setSpeechLanguage = vi.fn(() => false);
    window.FitrNative = native({ setSpeechLanguage });
    setActiveMessages("ko", en);
    expect(speechLocale()).toBe("en");
    expect(setSpeechLanguage).toHaveBeenCalledWith("ko-KR");
  });
});

describe("voice coach language", () => {
  it("speaks the active language's voice phrases", () => {
    const messages = { ...en, voice: { ...en.voice, letsGoGoal: "Allez. {goal}.", goalReps_other: "{count} {name}" } };
    setActiveMessages("fr", messages);
    const coach = new VoiceCoach({ exerciseName: "pompes", unit: "reps", goal: 20, t: speechTranslator("voice", "fr") });
    expect(coach.start(0)).toEqual([{ text: "Allez. 20 pompes.", interrupt: false }]);
  });

  it("uses bundled English when the voice falls back", () => {
    setActiveMessages("fr", { ...en, voice: { ...en.voice, letsGo: "Allez." } });
    expect(speechTranslator("voice", "en")("letsGo")).toBe(makeTranslator("en", en, "voice")("letsGo"));
  });
});
