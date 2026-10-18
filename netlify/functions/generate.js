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
      typeof value === "string" &&
      value.trim()
  );

  return taskId ? taskId.trim() : "";
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
    // SONG DETAILS
    // ======================================

    const title = cleanText(body.title);
    const prompt = cleanText(body.prompt);

    const mode =
      body.mode === "custom"
        ? "custom"
        : "automatic";

    const isCustom =
      mode === "custom";

    // ======================================
    // VALIDATE TITLE AND PROMPT
    // ======================================

    if (!title || !prompt) {
      return json(400, {
        success: false,
        error:
          "Jaza jina na maelezo au mashairi ya wimbo"
      });
    }

    if (title.length > 80) {
      return json(400, {
        success: false,
        error:
          "Jina la wimbo ni refu sana"
      });
    }

    if (
      isCustom &&
      prompt.length > 5000
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
    // MUSIC GENRE
    // ======================================

    const allowedGenres = [
      "Bongo Flava",
      "Mduara",
      "Afrobeat",
      "RnB",
      "Amapiano"
    ];

    const selectedGenre =
      allowedGenres.includes(body.genre)
        ? body.genre
        : "Bongo Flava";

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
    // MUSIC STYLE
    // ======================================

    const languageStyle =
      songLanguage === "Other"
        ? ""
        : songLanguage + " vocals";

    const style = [
      selectedGenre,
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

      // Send user's lyrics unchanged.

      payload.title = title;
      payload.prompt = prompt;
      payload.style = style;
      payload.vocal_gender = vocalGender;

      // Duration is supported only
      // when custom_mode is true.

      payload.duration = 180;

    } else {

      // ====================================
      // AUTOMATIC MODE - AI WRITES SONG
      // ====================================

      const languageInstruction =
        songLanguage === "Other"
          ? "Use the language requested in the song description."
          : "Write and sing the entire song in " +
            songLanguage + ".";

      const instructions = [
        "Music genre: " + selectedGenre + ".",
        "Vocal style: " +
          vocalDescription + ".",
        languageInstruction,
        "Write original meaningful lyrics.",
        "Include verses and a catchy chorus.",
        "Create a complete musical arrangement.",
        "Do not sing these instructions."
      ].join("\n");

      // Reserve space for instructions
      // without cutting user's text.

      const separator = "\n\n";

      const availableLength =
        3000 -
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

      payload.prompt =
        prompt +
        separator +
        instructions;

      // Do not send duration when
      // custom_mode is false.

    }

    // ======================================
    // FINAL PAYLOAD VALIDATION
    // ======================================

    if (
      payload.prompt.length >
      (isCustom ? 5000 : 3000)
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
        genre:
          selectedGenre,
        songLanguage,
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

      // INSUFFICIENT CREDITS

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

      // INVALID API KEY

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

      // RATE LIMIT

      if (
        response.status === 429
      ) {
        return json(429, {
          success: false,
          error:
            "reAPI imefikia kikomo cha maombi. Jaribu tena baadaye."
        });
      }

      // OTHER API ERRORS

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
      title,
      genre: selectedGenre,
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
