exports.handler = async (event) => {
  const json = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "GET") {
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

    const taskId = event.queryStringParameters?.task_id;

    if (!taskId) {
      return json(400, {
        error: "task_id inahitajika"
      });
    }

    const response = await fetch(
      `https://api.musicapi.ai/api/v1/sonic/task/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: "Imeshindikana kuangalia hali ya wimbo",
        details: data
      });
    }

    return json(200, data);

  } catch (error) {
    return json(500, {
      error: "Tatizo limetokea wakati wa kuangalia wimbo"
    });
  }
};
