exports.handler = async (event) => {

  const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return json(405, {
      error: "Method not allowed"
    });
  }

  try {

    const apiKey = process.env.MUSICAPI_KEY;
    const testPassword = process.env.MUSIC_TEST_PASSWORD;

    if (!apiKey || !testPassword) {
      console.error("Missing backend configuration");

      return json(500, {
        error: "Backend configuration haijakamilika"
      });
    }

    const suppliedPassword =
      event.headers["x-test-password"];

    if (
      !suppliedPassword ||
      suppliedPassword !== testPassword
    ) {
      return json(403, {
        error: "Huna ruhusa ya kutengeneza wimbo"
      });
    }

    let requestBody;

    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        error: "Taarifa zilizotumwa si sahihi"
      });
    }

    const {
      title,
      prompt,
      genre,
      voice
    } = requestBody;

    if (
      typeof title !== "string" ||
      typeof prompt !== "string" ||
      !title.trim() ||
      !prompt.trim()
    ) {
      return json(400, {
        error: "Jaza jina na mashairi ya wimbo"
      });
    }

    if (title.length > 150 || prompt.length > 5000) {
      return json(400, {
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

    const selectedGenre = allowedGenres.includes(genre)
      ? genre
      : "Bongo Flava";

    const vocalGender = voice === "Male" ? "m" : "f";

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

    console.log("MusicAPI: Sending generation request");

    const response = await fetch(
      "https://api.musicapi.ai/api/v1/sonic/create",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const rawResponse = await response.text();

    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      console.error(
        "MusicAPI returned invalid JSON. HTTP status:",
        response.status
      );

      return json(502, {
        error: "MusicAPI imerudisha jibu lisilo sahihi",
        http_status: response.status
      });
    }

    // Log only diagnostic fields, not the full response.
    console.log("MusicAPI HTTP status:", response.status);
    console.log("MusicAPI response code:", data.code ?? null);
    console.log("MusicAPI task ID present:", Boolean(data.task_id));

    if (!response.ok) {
      console.error("MusicAPI HTTP request failed");

      return json(502, {
        error: "MusicAPI imekataa ombi",
        http_status: response.status,
        api_code: data.code ?? null
      });
    }

  if (!data.task_id) {
      console.error("MusicAPI did not return a successful task");

      return json(502, {
        error: "MusicAPI haijaanzisha wimbo",
        api_code: data.code ?? null,
        task_id_present: Boolean(data.task_id)
      });
    }

    console.log("MusicAPI generation task accepted");

    return json(200, {
      success: true,
      task_id: data.task_id,
      message: data.message || "Wimbo umeanza kutengenezwa"
    });

  } catch (error) {

    console.error(
      "Backend error:",
      error instanceof Error ? error.name : "Unknown error"
    );

    return json(500, {
      error: "Tatizo limetokea kwenye backend"
    });

  }
};
