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

  if (event.httpMethod !== "GET") {
    return json(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const apiKey = process.env.MUSICAPI_KEY;

    if (!apiKey) {
      return json(500, {
        success: false,
        error: "MusicAPI key haipo kwenye Netlify"
      });
    }

    const taskId =
      event.queryStringParameters?.task_id;

    if (
      typeof taskId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(taskId)
    ) {
      return json(400, {
        success: false,
        error: "Task ID si sahihi"
      });
    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      20000
    );

    let response;

    try {
      response = await fetch(
        "https://api.musicapi.ai/api/v1/sonic/task/" +
        encodeURIComponent(taskId),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json"
          },
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
        error: "MusicAPI imerudisha majibu yasiyo JSON"
      });
    }

    if (!response.ok) {

      console.error("MusicAPI status error:", {
        httpStatus: response.status,
        apiCode: data.code ?? null
      });

      return json(502, {
        success: false,
        error: "Imeshindikana kuangalia hali ya wimbo",
        http_status: response.status
      });
    }

    const root =
      data.data ||
      data.result ||
      data;

    const rawStatus = String(
      root.status ||
      root.state ||
      root.task_status ||
      data.status ||
      ""
    ).toLowerCase();

    const failedStates = [
      "failed",
      "failure",
      "error",
      "cancelled",
      "canceled"
    ];

    const songs = [];
    const visited = new WeakSet();

    function safeURL(value) {
      if (typeof value !== "string") {
        return "";
      }

      try {
        const url = new URL(value);

        return (
          url.protocol === "https:" ||
          url.protocol === "http:"
        ) ? url.href : "";

      } catch {
        return "";
      }
    }

    function collect(value, depth = 0) {

      if (!value || depth > 7) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => {
          collect(item, depth + 1);
        });
        return;
      }

      if (typeof value !== "object") {
        return;
      }

      if (visited.has(value)) {
        return;
      }

      visited.add(value);

      const audioUrl = safeURL(
        value.audio_url ||
        value.audioUrl ||
        value.music_url ||
        value.musicUrl ||
        value.song_url ||
        value.stream_url ||
        value.play_url ||
        value.audio
      );

      if (
        audioUrl &&
        !songs.some(
          song => song.audioUrl === audioUrl
        )
      ) {
        songs.push({
          title:
            value.title ||
            value.song_name ||
            "",
          audioUrl,
          duration: Number(
            value.duration ||
            value.duration_seconds ||
            0
          )
        });
      }

      for (
        const [key, child]
        of Object.entries(value)
      ) {
        if (
          child &&
          typeof child === "object" &&
          key !== "metadata"
        ) {
          collect(child, depth + 1);
        }
      }
    }

    collect(root);

    let status = "processing";

    if (failedStates.includes(rawStatus)) {
      status = "failed";
    } else if (songs.length > 0) {
      status = "completed";
    }

    console.log("MusicAPI status:", {
      taskId,
      rawStatus,
      status,
      songsFound: songs.length,
      responseKeys: Object.keys(root)
    });

    return json(200, {
      success: true,
      task_id: taskId,
      status,
      raw_status: rawStatus,
      songs,
      message:
        status === "completed"
          ? "Nyimbo zimepatikana"
          : status === "failed"
            ? "Utengenezaji umeshindikana"
            : "Wimbo unaendelea kutengenezwa"
    });

  } catch (error) {

    if (error.name === "AbortError") {
      return json(504, {
        success: false,
        error: "MusicAPI imechelewa kujibu"
      });
    }

    console.error(
      "Status backend error:",
      error.name
    );

    return json(500, {
      success: false,
      error: "Tatizo limetokea wakati wa kuangalia wimbo"
    });
  }
};
