"use strict";

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

    const apiKey = process.env.REAPI_API_KEY;
    const testPassword = process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {
      console.error("Missing reAPI configuration");

      return json(500, {
        success: false,
        error: "Backend configuration haijakamilika"
      });
    }

    // ==========================================
    // TEST PASSWORD
    // ==========================================

    const suppliedPassword =
      event.headers?.["x-test-password"] ||
      event.headers?.["X-Test-Password"];

    if (
      !suppliedPassword ||
      suppliedPassword !== testPassword
    ) {
      return json(403, {
        success: false,
        error: "Nenosiri la majaribio si sahihi"
      });
    }

    // ==========================================
    // READ REQUEST BODY
    // ==========================================

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        success: false,
        error: "Taarifa zilizotumwa si sahihi"
      });
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json(400, {
        success: false,
        error: "Taarifa za wimbo si sahihi"
      });
    }

    // ==========================================
    // SONG INFORMATION
    // ==========================================

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    const genre = body.genre;
    const voice = body.voice;

    const mode =
      body.mode === "custom"
        ? "custom"
        : "automatic";

    // ==========================================
    // SONG LANGUAGE
    // ==========================================

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
      allowedLanguages.includes(body.songLanguage)
        ? body.songLanguage
        : "Swahili";

    // ==========================================
    // VALIDATE INPUT
    // ==========================================

    if (!title || !prompt) {
      return json(400, {
        success: false,
        error: "Jaza jina na maelezo au mashairi ya wimbo"
      });
    }

    const isCustom = mode === "custom";

    if (
      title.length > 80 ||
      prompt.length > (isCustom ? 5000 : 3000)
    ) {
      return json(400, {
        success: false,
        error: "Maandishi ni marefu kupita kiasi"
      });
    }

    // ==========================================
    // MUSIC GENRE
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

    const vocalDescription =
      voice === "Male"
        ? "male vocals"
        : "female vocals";

    // ==========================================
    // MUSIC STYLE
    // ==========================================

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

    // ==========================================
    // REAPI PAYLOAD
    // ==========================================

    const payload = {
      model: "suno-music",
      version: "V6",
      custom_mode: isCustom,
      instrumental: false
    };

    // ==========================================
    // CUSTOM MODE — MY LYRICS
    // ==========================================

    if (isCustom) {

      // Mashairi ya mtumiaji yanatumwa
      // bila kuyaongezea maelekezo.

      payload.title = title;
      payload.prompt = prompt;
      payload.style = style;
      payload.vocal_gender = vocalGender;

      // Muda wa wimbo:
      // Sekunde 180 = dakika 3.
      // reAPI inaruhusu duration
      // kwenye custom mode.

      payload.duration = 180;

    } else {

      // ========================================
      // AUTOMATIC MODE — AI WRITES SONG
      // ========================================

      const languageInstruction =
        songLanguage === "Other"
          ? "Use the language requested in the song description."
          : "Write and sing the lyrics in " +
            songLanguage + ".";

      payload.prompt = [
        prompt,
        "",
        "Music genre: " + selectedGenre + ".",
        "Vocal style: " + vocalDescription + ".",
        languageInstruction,
        "Compose original song lyrics based on the description.",
        "Include verses and a memorable chorus.",
        "Create a complete musical arrangement.",
        "Treat this text as creative instructions, not lyrics to sing."
      ].join("\n");

    }

    // ==========================================
    // API REQUEST TIMEOUT
    // ==========================================

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      25000
    );

    let response;

    // ==========================================
    // SEND REQUEST TO REAPI
    // ==========================================

    try {

      response = await fetch(
        "https://reapi.ai/api/v1/audio/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

    } finally {

      clearTimeout(timeout);

    }

    // ==========================================
    // READ REAPI RESPONSE
    // ==========================================

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return json(502, {
        success: false,
        error: "reAPI imerudisha jibu lisilo JSON"
      });
    }

    // ==========================================
    // SAFE BACKEND LOG
    // ==========================================

    console.log("reAPI generation:", {
      httpStatus: response.status,
      mode,
      songLanguage,
      genre: selectedGenre,
      hasTaskId: Boolean(
        data?.id ||
        data?.task_id ||
        data?.data?.id
      )
    });

    // ==========================================
    // HANDLE API ERRORS
    // ==========================================

    if (!response.ok) {

      const apiMessage = String(
        data?.error?.message ||
        data?.message ||
        data?.detail ||
        ""
      ).toLowerCase();

      if (
        response.status === 402 ||
        apiMessage.includes("credit") ||
        apiMessage.includes("balance") ||
        apiMessage.includes("insufficient")
      ) {
        return json(402, {
          success: false,
          error:
            "Credits za reAPI hazitoshi. Ongeza credits kwenye akaunti yako.",
          http_status: response.status
        });
      }

      if (response.status === 401) {
        return json(502, {
          success: false,
          error: "reAPI API key si sahihi"
        });
      }

      if (response.status === 429) {
        return json(429, {
          success: false,
          error:
            "reAPI imefikia kikomo cha maombi. Jaribu tena baadaye."
        });
      }

      console.error("reAPI rejected request:", {
        status: response.status,
        code: data?.error?.code ?? data?.code ?? null,
        message:
          data?.error?.message ||
          data?.message ||
          null
      });

      return json(502, {
        success: false,
        error: "reAPI imekataa ombi",
        http_status: response.status,
        api_code:
          data?.error?.code ??
          data?.code ??
          null
      });
    }

    // ==========================================
    // CHECK API-LEVEL ERROR
    // ==========================================

    if (
      data?.success === false ||
      data?.status === "failed" ||
      data?.error
    ) {
      return json(502, {
        success: false,
        error: "reAPI imerudisha hitilafu",
        api_code:
          data?.error?.code ??
          data?.code ??
          null
      });
    }

    // ==========================================
    // EXTRACT TASK ID
    // ==========================================

    const taskId =
      data?.id ||
      data?.task_id ||
      data?.data?.id ||
      data?.data?.task_id;

    if (
      !taskId ||
      typeof taskId !== "string"
    ) {
      return json(502, {
        success: false,
        error:
          "reAPI haijarudisha Task ID. Angalia Task Logs kabla ya kujaribu tena."
      });
    }

    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================

    return json(200, {
      success: true,
      task_id: taskId,
      mode,
      title,
      genre: selectedGenre,
      voice: vocalGender,
      songLanguage,
      message: "Wimbo umeanza kutengenezwa",
      model: "suno-music",
      version: "V6"
    });

  } catch (error) {

    // ==========================================
    // TIMEOUT
    // ==========================================

    if (error.name === "AbortError") {
      return json(504, {
        success: false,
        error:
          "reAPI imechelewa kujibu. Angalia Task Logs kabla ya kujaribu tena."
      });
    }

    // ==========================================
    // BACKEND ERROR
    // ==========================================

    console.error(
      "Generate backend error:",
      error.name,
      error.message
    );

    return json(500, {
      success: false,
      error: "Tatizo limetokea kwenye backend"
    });
  }
};
