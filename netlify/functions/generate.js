exports.handler = async (event) => {

  // ==========================================
  // JSON RESPONSE
  // ==========================================

  const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  // ==========================================
  // ALLOW POST ONLY
  // ==========================================

  if (event.httpMethod !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // ==========================================
    // ENVIRONMENT VARIABLES
    // ==========================================

    const apiKey = process.env.MUSICAPI_KEY;
    const testPassword = process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {

      console.error(
        "Backend configuration missing",
        {
          apiKeyConfigured: Boolean(apiKey),
          testPasswordConfigured: Boolean(testPassword)
        }
      );

      return json(500, {
        success: false,
        error: "Backend configuration haijakamilika"
      });

    }

    // ==========================================
    // TEST PASSWORD VERIFICATION
    // ==========================================

    const suppliedPassword =
      event.headers?.["x-test-password"] ||
      event.headers?.["X-Test-Password"];

    if (
      !suppliedPassword ||
      suppliedPassword !== testPassword
    ) {

      console.warn(
        "Unauthorized generation request"
      );

      return json(403, {
        success: false,
        error: "Huna ruhusa ya kutengeneza wimbo"
      });

    }

    // ==========================================
    // READ REQUEST BODY
    // ==========================================

    let requestBody;

    try {

      requestBody = JSON.parse(
        event.body || "{}"
      );

    } catch (error) {

      return json(400, {
        success: false,
        error: "Taarifa zilizotumwa si sahihi"
      });

    }

    const {
      title,
      prompt,
      genre,
      voice
    } = requestBody;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (
      typeof title !== "string" ||
      typeof prompt !== "string" ||
      !title.trim() ||
      !prompt.trim()
    ) {

      return json(400, {
        success: false,
        error: "Jaza jina na mashairi ya wimbo"
      });

    }

    if (
      title.length > 150 ||
      prompt.length > 5000
    ) {

      return json(400, {
        success: false,
        error: "Maandishi ni marefu kupita kiasi"
      });

    }

    // ==========================================
    // MUSIC GENRES
    // ==========================================

    const allowedGenres = [
      "Bongo Flava",
      "Mduara",
      "Afrobeat",
      "RnB",
      "Amapiano"
    ];

    const selectedGenre =
      allowedGenres.includes(genre)
        ? genre
        : "Bongo Flava";

    // ==========================================
    // VOCAL GENDER
    // ==========================================

    const vocalGender =
      voice === "Male" ? "m" : "f";

    // ==========================================
    // MUSICAPI PAYLOAD
    // ==========================================

    const payload = {

      task_type: "create_music",

      custom_mode: true,

      mv: "sonic-v6",

      title: title.trim(),

      prompt: prompt.trim(),

      tags: selectedGenre,

      vocal_gender: vocalGender,

      make_instrumental: false

    };

    // ==========================================
    // SEND REQUEST TO MUSICAPI
    // ==========================================

    console.log(
      "MusicAPI: Sending generation request"
    );

    console.log(
      "MusicAPI model:",
      payload.mv
    );

    console.log(
      "MusicAPI genre:",
      selectedGenre
    );

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    let response;

    try {

      response = await fetch(
        "https://api.musicapi.ai/api/v1/sonic/create",
        {
          method: "POST",

          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },

          body: JSON.stringify(payload),

          signal: controller.signal
        }
      );

    } finally {

      clearTimeout(timeout);

    }

    // ==========================================
    // READ MUSICAPI RESPONSE
    // ==========================================

    const rawResponse =
      await response.text();

    let data;

    try {

      data = JSON.parse(rawResponse);

    } catch (error) {

      console.error(
        "MusicAPI invalid JSON response",
        {
          httpStatus: response.status
        }
      );

      return json(502, {
        success: false,
        error: "MusicAPI imerudisha jibu lisilo sahihi",
        http_status: response.status
      });

    }

    // ==========================================
    // MUSICAPI DIAGNOSTIC LOGS
    // ==========================================

    console.log(
      "MusicAPI HTTP status:",
      response.status
    );

    console.log(
      "MusicAPI response code:",
      data.code ?? null
    );

    console.log(
      "MusicAPI task ID present:",
      Boolean(data.task_id)
    );

    // IMPORTANT:
    // Log safe diagnostic fields only.
    // Do not log API keys or request headers.

    const apiErrorMessage =
      typeof data.message === "string"
        ? data.message.slice(0, 500)
        : typeof data.error === "string"
          ? data.error.slice(0, 500)
          : typeof data.detail === "string"
            ? data.detail.slice(0, 500)
            : null;

    // ==========================================
    // HANDLE MUSICAPI HTTP ERRORS
    // ==========================================

    if (!response.ok) {

      console.error(
        "MusicAPI request rejected:",
        {
          httpStatus: response.status,
          apiCode: data.code ?? null,
          apiMessage: apiErrorMessage
        }
      );

      let errorMessage =
        "MusicAPI imekataa ombi";

      if (response.status === 401) {

        errorMessage =
          "MusicAPI authentication imeshindikana. Hakiki API key.";

      } else if (response.status === 403) {

        errorMessage =
          "MusicAPI imezuia ombi (403). Angalia Netlify Logs kwa sababu halisi.";

      } else if (response.status === 402) {

        errorMessage =
          "MusicAPI inahitaji credits au malipo.";

      } else if (response.status === 429) {

        errorMessage =
          "MusicAPI imefikia kikomo cha maombi. Jaribu baadaye.";

      } else if (response.status >= 500) {

        errorMessage =
          "MusicAPI ina tatizo la seva. Jaribu baadaye.";

      }

      return json(502, {
        success: false,
        error: errorMessage,
        http_status: response.status,
        api_code: data.code ?? null
      });

    }

    // ==========================================
    // CHECK TASK ID
    // ==========================================

    if (
      !data.task_id ||
      typeof data.task_id !== "string"
    ) {

      console.error(
        "MusicAPI did not return task ID",
        {
          httpStatus: response.status,
          apiCode: data.code ?? null,
          apiMessage: apiErrorMessage
        }
      );

      return json(502, {
        success: false,
        error: "MusicAPI haijaanzisha wimbo",
        http_status: response.status,
        api_code: data.code ?? null
      });

    }

    // ==========================================
    // GENERATION ACCEPTED
    // ==========================================

    console.log(
      "MusicAPI generation task accepted"
    );

    return json(200, {

      success: true,

      task_id: data.task_id,

      message:
        "Wimbo wako umeanza kutengenezwa",

      model: "sonic-v6"

    });

  } catch (error) {

    // ==========================================
    // BACKEND ERROR HANDLING
    // ==========================================

    if (error.name === "AbortError") {

      console.error(
        "MusicAPI request timeout"
      );

      return json(504, {
        success: false,
        error: "MusicAPI imechelewa kujibu. Jaribu tena baadaye."
      });

    }

    console.error(
      "Backend error:",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    return json(500, {
      success: false,
      error: "Tatizo limetokea kwenye backend"
    });

  }

};
