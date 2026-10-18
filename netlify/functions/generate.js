"use strict";

exports.handler = async (event) => {

  const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const apiKey = process.env.MUSICAPI_KEY;
    const testPassword = process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {
      return json(500, {
        success: false,
        error: "Backend configuration haijakamilika"
      });
    }

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

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        success: false,
        error: "Taarifa zilizotumwa si sahihi"
      });
    }

    const title = body.title;
    const prompt = body.prompt;
    const genre = body.genre;
    const voice = body.voice;

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

    const vocalGender =
      voice === "Male" ? "m" : "f";

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

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      25000
    );

    let response;

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

    console.log("MusicAPI generation:", {
      httpStatus: response.status,
      apiCode: data.code ?? null,
      hasTaskId: Boolean(
        data.task_id ||
        data.data?.task_id
      )
    });

    if (!response.ok) {

      const apiMessage = String(
        data.message ||
        data.error ||
        data.detail ||
        ""
      ).toLowerCase();

      if (
        apiMessage.includes("credit") ||
        apiMessage.includes("balance") ||
        apiMessage.includes("subscribe")
      ) {
        return json(402, {
          success: false,
          error:
            "Credits za MusicAPI hazitoshi kutengeneza wimbo mpya. Ongeza credits kwenye MusicAPI.",
          http_status: response.status
        });
      }

      if (response.status === 401) {
        return json(502, {
          success: false,
          error: "MusicAPI API key si sahihi"
        });
      }

      if (response.status === 429) {
        return json(429, {
          success: false,
          error: "MusicAPI imefikia kikomo cha maombi. Jaribu baadaye."
        });
      }

      return json(502, {
        success: false,
        error: "MusicAPI imekataa ombi",
        http_status: response.status,
        api_code: data.code ?? null
      });
    }

    const taskId =
      data.task_id ||
      data.data?.task_id ||
      data.result?.task_id;

    if (
      !taskId ||
      typeof taskId !== "string"
    ) {
      return json(502, {
        success: false,
        error: "MusicAPI haijarudisha Task ID"
      });
    }

    return json(200, {
      success: true,
      task_id: taskId,
      message: "Wimbo umeanza kutengenezwa",
      model: "sonic-v6"
    });

  } catch (error) {

    if (error.name === "AbortError") {
      return json(504, {
        success: false,
        error: "MusicAPI imechelewa kujibu. Angalia Usage Details kabla ya kujaribu tena."
      });
    }

    console.error(
      "Generate backend error:",
      error.name
    );

    return json(500, {
      success: false,
      error: "Tatizo limetokea kwenye backend"
    });
  }
};
