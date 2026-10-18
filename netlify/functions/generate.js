"use strict";

// ==========================================
// REAPI SUNO V6 - NETLIFY FUNCTION
// ==========================================

const REAPI_URL =
  "https://reapi.ai/api/v1/audio/generations";

const MODEL = "suno-music";
const VERSION = "V6";

const REQUEST_TIMEOUT = 25000;

// ==========================================
// LIMITS
// ==========================================

const MAX_TITLE_LENGTH = 80;
const MAX_STYLE_LENGTH = 600;
const MAX_CUSTOM_PROMPT = 5000;
const MAX_AUTOMATIC_PROMPT = 3000;

// ==========================================
// JSON RESPONSE
// ==========================================

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

// ==========================================
// NORMALIZE TEXT
// ==========================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

// ==========================================
// EXTRACT ERROR MESSAGE
// ==========================================

function getApiMessage(data) {
  const candidates = [
    data?.error?.message,
    data?.error?.detail,
    data?.message,
    data?.detail,
    typeof data?.error === "string"
      ? data.error
      : ""
  ];

  return candidates.find(
    value =>
      typeof value === "string" &&
      value.trim()
  ) || "";
}

// ==========================================
// EXTRACT TASK ID
// ==========================================

function getTaskId(data) {
  const candidates = [
    data?.id,
    data?.task_id,
    data?.data?.id,
    data?.data?.task_id,
    data?.result?.id,
    data?.result?.task_id
  ];

  const taskId = candidates.find(
    value =>
      (
        typeof value === "string" &&
        value.trim()
      ) ||
      (
        typeof value === "number" &&
        Number.isFinite(value)
      )
  );

  return taskId !== undefined
    ? String(taskId).trim()
    : "";
}

// ==========================================
// MAIN HANDLER
// ==========================================

exports.handler = async (event) => {

  // ========================================
  // ALLOW POST ONLY
  // ========================================

  if (event.httpMethod !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // ======================================
    // ENVIRONMENT VARIABLES
    // ======================================

    const apiKey = cleanText(
      process.env.REAPI_API_KEY
    );

    const testPassword =
      process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {

      console.error(
        "Missing REAPI_API_KEY or MUSIC_TEST_PASSWORD"
      );

      return json(500, {
        success: false,
        error:
          "Backend configuration haijakamilika"
      });
    }

    // ======================================
    // TEST PASSWORD
    // ======================================

    const headers = event.headers || {};

    const suppliedPassword =
      headers["x-test-password"] ||
      headers["X-Test-Password"] ||
      "";

    if (
      !suppliedPassword ||
      suppliedPassword !== testPassword
    ) {

      return json(403, {
        success: false,
        error:
          "Nenosiri la majaribio si sahihi"
      });
    }

    // ======================================
    // PARSE REQUEST BODY
    // ======================================

    let body;

    try {

      body = JSON.parse(
        event.body || "{}"
      );

    } catch {

      return json(400, {
        success: false,
        error:
          "Taarifa zilizotumwa si sahihi"
      });
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {

      return json(400, {
        success: false,
        error:
          "Taarifa za wimbo si sahihi"
      });
    }

    // ======================================
    // CREATION MODE
    // ======================================

    const mode =
      body.mode === "custom"
        ? "custom"
        : "automatic";

    const isCustom =
      mode === "custom";

    // ======================================
    // SONG DETAILS
    // ======================================

    const title = cleanText(body.title);

    const prompt = cleanText(body.prompt);

    // NEW:
    // Music Style sasa inatoka
    // kwenye textarea ya mtumiaji.

    const musicStyle = cleanText(
      body.musicStyle
    );

    // ======================================
    // VALIDATE SONG DESCRIPTION
    // ======================================

    if (!prompt) {

      return json(400, {
        success: false,
        error:
          "Andika maelezo au mashairi ya wimbo"
      });
    }

    // ======================================
    // VALIDATE MUSIC STYLE
    // ======================================

    if (!musicStyle) {

      return json(400, {
        success: false,
        error:
          "Andika Music Style unayotaka"
      });
    }

    if (
      musicStyle.length > MAX_STYLE_LENGTH
    ) {

      return json(400, {
        success: false,
        error:
          "Music Style ni ndefu sana. Kikomo ni herufi 600."
      });
    }

    // ======================================
    // VALIDATE TITLE
    // ======================================

    // Automatic Mode:
    // Jina halihitajiki.
    //
    // Custom Mode:
    // Jina linahitajika.

    if (isCustom && !title) {

      return json(400, {
        success: false,
        error:
          "Andika jina la wimbo kwenye Mashairi Yangu"
      });
    }

    if (
      isCustom &&
      title.length > MAX_TITLE_LENGTH
    ) {

      return json(400, {
        success: false,
        error:
          "Jina la wimbo ni refu sana"
      });
    }

    // ======================================
    // VALIDATE CUSTOM LYRICS
    // ======================================

    if (
      isCustom &&
      prompt.length > MAX_CUSTOM_PROMPT
    ) {

      return json(400, {
        success: false,
        error:
          "Mashairi ni marefu kupita kiasi"
      });
    }

    // ======================================
    // SONG LANGUAGE
    // ======================================

    const allowedLanguages = [
      "Swahili",
      "English",
      "French",
      "Spanish",
      "Portuguese",
      "Arabic",
      "Hindi",
      "Other"
    ];

    const songLanguage =
      allowedLanguages.includes(
        body.songLanguage
      )
        ? body.songLanguage
        : "Swahili";

    // ======================================
    // VOCAL GENDER
    // ======================================

    const vocalGender =
      body.voice === "Male"
        ? "m"
        : "f";

    const vocalDescription =
      vocalGender === "m"
        ? "male vocals"
        : "female vocals";

    // ======================================
    // LANGUAGE DESCRIPTION
    // ======================================

    const languageStyle =
      songLanguage === "Other"
        ? ""
        : songLanguage + " vocals";

    // ======================================
    // FINAL MUSIC STYLE
    // ======================================

    // Music Style ya mtumiaji
    // inaongezewa lugha na aina ya sauti.
    //
    // Mfano:
    //
    // Bongo Flava, 95 BPM, soft piano,
    // deep bass, Swahili vocals,
    // male vocals

    const style = [
      musicStyle,
      languageStyle,
      vocalDescription,
      "professional studio production",
      "clear vocals"
    ]
      .filter(Boolean)
      .join(", ");

    // ======================================
    // REAPI PAYLOAD
    // ======================================

    const payload = {
      model: MODEL,
      version: VERSION,
      custom_mode: isCustom,
      instrumental: false
    };

    // ======================================
    // CUSTOM MODE - MY LYRICS
    // ======================================

    if (isCustom) {

      // ====================================
      // USER WRITES TITLE AND LYRICS
      // ====================================

      // Jina la wimbo linatumwa
      // kama title halisi.

      payload.title = title;

      // Mashairi ya mtumiaji
      // hayabadilishwi.

      payload.prompt = prompt;

      // Mtumiaji anaweza kuandika:
      // genre, tempo, BPM, instruments,
      // mood, production style, n.k.

      payload.style = style;

      payload.vocal_gender =
        vocalGender;

      // Duration hutumika kwenye
      // Custom Mode pekee.

      payload.duration = 180;

    } else {

      // ====================================
      // AUTOMATIC MODE - AI WRITES SONG
      // ====================================

      // Hakuna title inayotumwa.
      //
      // AI itachagua jina la wimbo
      // kulingana na maelezo.

      const languageInstruction =
        songLanguage === "Other"
          ? "Use the language requested in the song description."
          : "Write and sing the entire song in " +
            songLanguage + ".";

      // ====================================
      // MUSIC INSTRUCTIONS
      // ====================================

      const instructions = [

        "Create an original complete song.",

        "Music style: " + musicStyle + ".",

        "Vocal style: " +
          vocalDescription + ".",

        languageInstruction,

        "Write meaningful original lyrics.",

        "Choose a suitable song title based on the story and lyrics.",

        "Include verses and a memorable chorus.",

        "Follow the requested genre, tempo, BPM, instruments and mood.",

        "Create a professional musical arrangement.",

        "Do not sing these instructions."

      ].join("\n");

      // ====================================
      // PROMPT LENGTH VALIDATION
      // ====================================

      const separator = "\n\n";

      const availableLength =
        MAX_AUTOMATIC_PROMPT -
        instructions.length -
        separator.length;

      if (
        availableLength < 1 ||
        prompt.length > availableLength
      ) {

        return json(400, {
          success: false,
          error:
            "Maelezo ya wimbo ni marefu sana. Yafupishe kidogo."
        });
      }

      // ====================================
      // FINAL AUTOMATIC PROMPT
      // ====================================

      payload.prompt =
        prompt +
        separator +
        instructions;

      // Muhimu:
      // Hakuna payload.title.
      // Hakuna payload.duration.
      //
      // Tunatumia Automatic Mode
      // kama ilivyokuwa awali.

    }

    // ======================================
    // FINAL PAYLOAD VALIDATION
    // ======================================

    if (
      payload.prompt.length >
      (
        isCustom
          ? MAX_CUSTOM_PROMPT
          : MAX_AUTOMATIC_PROMPT
      )
    ) {

      return json(400, {
        success: false,
        error:
          "Maandishi ya wimbo yamezidi kikomo"
      });
    }

    // ======================================
    // REQUEST TIMEOUT
    // ======================================

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    let response;
    let raw;

    // ======================================
    // SEND REQUEST TO REAPI
    // ======================================

    try {

      response = await fetch(
        REAPI_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + apiKey,
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },
          body:
            JSON.stringify(payload),
          signal:
            controller.signal
        }
      );

      raw = await response.text();

    } finally {

      clearTimeout(timeout);

    }

    // ======================================
    // PARSE API RESPONSE
    // ======================================

    let data;

    try {

      data = JSON.parse(raw);

    } catch {

      console.error(
        "reAPI returned invalid JSON",
        {
          httpStatus:
            response.status
        }
      );

      return json(502, {
        success: false,
        error:
          "reAPI imerudisha jibu lisilo sahihi. Angalia Task Logs kabla ya kujaribu tena."
      });
    }

    // ======================================
    // API RESPONSE LOG
    // ======================================

    const taskId =
      getTaskId(data);

    console.log(
      "reAPI generation:",
      {
        httpStatus:
          response.status,
        mode,
        songLanguage,
        hasMusicStyle:
          Boolean(musicStyle),
        hasTaskId:
          Boolean(taskId)
      }
    );

    // ======================================
    // HANDLE API ERRORS
    // ======================================

    if (!response.ok) {

      const apiMessage =
        getApiMessage(data);

      const lowerMessage =
        apiMessage.toLowerCase();

      // ====================================
      // INSUFFICIENT CREDITS
      // ====================================

      if (
        response.status === 402 ||
        lowerMessage.includes(
          "insufficient"
        ) ||
        lowerMessage.includes(
          "credit"
        ) ||
        lowerMessage.includes(
          "balance"
        )
      ) {

        return json(402, {
          success: false,
          error:
            "Credits za reAPI hazitoshi. Ongeza credits kwenye akaunti yako.",
          http_status:
            response.status
        });
      }

      // ====================================
      // INVALID API KEY
      // ====================================

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        return json(502, {
          success: false,
          error:
            "reAPI imekataa API Key au ruhusa ya akaunti.",
          http_status:
            response.status
        });
      }

      // ====================================
      // RATE LIMIT
      // ====================================

      if (
        response.status === 429
      ) {

        return json(429, {
          success: false,
          error:
            "reAPI imefikia kikomo cha maombi. Jaribu tena baadaye."
        });
      }

      // ====================================
      // OTHER API ERRORS
      // ====================================

      console.error(
        "reAPI rejected request:",
        {
          httpStatus:
            response.status,
          apiCode:
            data?.error?.code ??
            data?.code ??
            null,
          apiMessage:
            apiMessage.slice(0, 300)
        }
      );

      return json(502, {
        success: false,
        error:
          "reAPI imekataa ombi. Angalia Netlify Function Logs.",
        http_status:
          response.status,
        api_code:
          data?.error?.code ??
          data?.code ??
          null
      });
    }

    // ======================================
    // API-LEVEL ERRORS
    // ======================================

    const apiStatus =
      cleanText(
        data?.status ||
        data?.data?.status
      ).toLowerCase();

    if (
      data?.success === false ||
      [
        "failed",
        "failure",
        "error",
        "cancelled",
        "canceled"
      ].includes(apiStatus) ||
      data?.error
    ) {

      console.error(
        "reAPI returned API-level error:",
        {
          status:
            apiStatus,
          code:
            data?.error?.code ??
            data?.code ??
            null
        }
      );

      return json(502, {
        success: false,
        error:
          "reAPI imerudisha hitilafu. Angalia Task Logs."
      });
    }

    // ======================================
    // VALIDATE TASK ID
    // ======================================

    if (
      !taskId ||
      !/^[a-zA-Z0-9_-]{8,150}$/.test(
        taskId
      )
    ) {

      console.error(
        "reAPI task ID missing or invalid",
        {
          responseKeys:
            data &&
            typeof data === "object"
              ? Object.keys(data)
              : []
        }
      );

      return json(502, {
        success: false,
        error:
          "reAPI haijarudisha Task ID inayotambulika. Angalia Task Logs kabla ya kujaribu tena."
      });
    }

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    return json(200, {
      success: true,

      task_id: taskId,

      mode,

      title: isCustom
        ? title
        : "",

      musicStyle,

      voice: vocalGender,

      songLanguage,

      message:
        "Wimbo umeanza kutengenezwa",

      model: MODEL,

      version: VERSION
    });

  } catch (error) {

    // ======================================
    // TIMEOUT
    // ======================================

    if (
      error?.name === "AbortError"
    ) {

      return json(504, {
        success: false,
        error:
          "reAPI imechelewa kujibu. Angalia Task Logs kabla ya kujaribu tena ili kuepuka kukatwa credits mara mbili."
      });
    }

    // ======================================
    // BACKEND ERROR
    // ======================================

    console.error(
      "Generate backend error:",
      error?.name,
      error?.message
    );

    return json(500, {
      success: false,
      error:
        "Tatizo limetokea kwenye backend"
    });
  }
};
