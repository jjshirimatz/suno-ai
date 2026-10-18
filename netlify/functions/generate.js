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

    const apiKey = process.env.MUSICAPI_KEY;
    const testPassword = process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {
      console.error("Missing MusicAPI configuration");

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
        ? "male singer"
        : "female singer";

    // ==========================================
    // CREATION MODE
    // ==========================================

    const isCustom = mode === "custom";

    // ==========================================
    // MUSICAPI PAYLOAD
    // ==========================================

    const payload = {
      task_type: "create_music",
      custom_mode: isCustom,
      mv: "sonic-v6",
      make_instrumental: false
    };

    // ==========================================
    // CUSTOM MODE — MY LYRICS
    // ==========================================

    if (isCustom) {

      /*
        Mtumiaji ameandika mashairi yake.

        Hapa hatuongezi maelekezo mengine
        ndani ya prompt ili AI isiimbe
        maneno ambayo si sehemu ya mashairi.
      */

      payload.title = title;

      payload.prompt = prompt;

      payload.tags =
        selectedGenre +
        ", " +
        songLanguage +
        " vocals, " +
        vocalDescription;

      payload.vocal_gender = vocalGender;

    } else {

      // ========================================
      // AUTOMATIC MODE — AI WRITES SONG
      // ========================================

      /*
        Mtumiaji anaeleza wazo la wimbo.

        custom_mode = false.

        Prompt inakuwa maelekezo kwa AI
        kutunga mashairi na muziki.
      */

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
    // SEND REQUEST TO MUSICAPI
    // ==========================================

    try {

      response = await fetch(
        "https://api.musicapi.ai/api/v1/sonic/create",
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
    // READ MUSICAPI RESPONSE
    // ==========================================

    const raw = await response.text();

    let data;

    try {

      data = JSON.parse(raw);

    } catch {

      return json(502, {
        success: false,
        error: "MusicAPI imerudisha jibu lisilo JSON"
      });

    }

    // ==========================================
    // SAFE BACKEND LOG
    // ==========================================

    console.log("MusicAPI generation:", {
      httpStatus: response.status,
      apiCode: data?.code ?? null,
      mode,
      songLanguage,
      genre: selectedGenre,
      hasTaskId: Boolean(
        data?.task_id ||
        data?.data?.task_id ||
        data?.result?.task_id
      )
    });

    // ==========================================
    // HANDLE API ERRORS
    // ==========================================

    if (!response.ok) {

      const apiMessage = String(
        data?.message ||
        data?.error ||
        data?.detail ||
        ""
      ).toLowerCase();

      // INSUFFICIENT CREDITS

      if (
        apiMessage.includes("credit") ||
        apiMessage.includes("balance") ||
        apiMessage.includes("subscribe")
      ) {

        return json(402, {
          success: false,
          error:
            "Credits za MusicAPI hazitoshi. Ongeza credits kwenye akaunti yako ya MusicAPI.",
          http_status: response.status
        });

      }

      // INVALID API KEY

      if (response.status === 401) {

        return json(502, {
          success: false,
          error: "MusicAPI API key si sahihi"
        });

      }

      // RATE LIMIT

      if (response.status === 429) {

        return json(429, {
          success: false,
          error:
            "MusicAPI imefikia kikomo cha maombi. Jaribu tena baadaye."
        });

      }

      // OTHER API ERRORS

      return json(502, {
        success: false,
        error: "MusicAPI imekataa ombi",
        http_status: response.status,
        api_code: data?.code ?? null
      });

    }

    // ==========================================
    // CHECK API-LEVEL ERROR
    // ==========================================

    if (
      data?.success === false ||
      (
        typeof data?.code === "number" &&
        data.code >= 400
      )
    ) {

      return json(502, {
        success: false,
        error: "MusicAPI imerudisha hitilafu",
        api_code: data?.code ?? null
      });

    }

    // ==========================================
    // EXTRACT TASK ID
    // ==========================================

    const taskId =
      data?.task_id ||
      data?.data?.task_id ||
      data?.result?.task_id;

    if (
      !taskId ||
      typeof taskId !== "string"
    ) {

      return json(502, {
        success: false,
        error:
          "MusicAPI haijarudisha Task ID. Angalia Usage Details kabla ya kujaribu tena."
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
      model: "sonic-v6"
    });

  } catch (error) {

    // ==========================================
    // TIMEOUT
    // ==========================================

    if (error.name === "AbortError") {

      return json(504, {
        success: false,
        error:
          "MusicAPI imechelewa kujibu. Angalia Usage Details kabla ya kujaribu tena."
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
