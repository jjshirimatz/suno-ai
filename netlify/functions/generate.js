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

    if (!apiKey) {
      return json(500, {
        error: "MusicAPI key haipo kwenye Netlify"
      });
    }

    const {
      title,
      prompt,
      genre,
      voice
    } = JSON.parse(event.body || "{}");

    if (!title || !prompt) {
      return json(400, {
        error: "Jina na maelezo ya wimbo yanahitajika"
      });
    }

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
          mv: "sonic-v5",
          title: title,
          tags: `${genre || "Bongo Flava"}, ${voice || "Female"} vocals`,
          prompt: prompt,
          make_instrumental: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: "MusicAPI request failed",
        details: data
      });
    }

    return json(200, data);

  } catch (error) {

    return json(500, {
      error: "Imeshindikana kuanzisha utengenezaji wa wimbo"
    });

  }
};
