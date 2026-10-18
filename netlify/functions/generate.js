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

    const {
      title,
      prompt,
      genre,
      voice
    } = JSON.parse(event.body || "{}");

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

    const response = await fetch(
      "https://api.musicapi.ai/api/v1/sonic/create",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          task_type: "create_music",
          custom_mode: true,
          mv: "sonic-v6",
          title: title.trim(),
          prompt: prompt.trim(),
          tags: selectedGenre,
          vocal_gender: vocalGender,
          make_instrumental: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.code !== 200) {
      return json(502, {
        error: "MusicAPI imeshindwa kuanzisha wimbo",
        details: data
      });
    }

    return json(200, {
      success: true,
      task_id: data.task_id,
      message: data.message
    });

  } catch (error) {

    return json(500, {
      error: "Tatizo limetokea kwenye backend"
    });

  }
};
