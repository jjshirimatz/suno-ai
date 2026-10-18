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
  // ALLOW GET ONLY
  // ==========================================

  if (event.httpMethod !== "GET") {
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

    if (!apiKey) {
      console.error("Missing REAPI_API_KEY");

      return json(500, {
        success: false,
        error: "reAPI key haipo kwenye Netlify"
      });
    }

    // ==========================================
    // READ TASK ID
    // ==========================================

    const taskId =
      event.queryStringParameters?.task_id;

    if (
      typeof taskId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,150}$/.test(taskId)
    ) {
      return json(400, {
        success: false,
        error: "Task ID si sahihi"
      });
    }

    // ==========================================
    // REQUEST TIMEOUT
    // ==========================================

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      20000
    );

    let response;

    // ==========================================
    // FETCH REAPI TASK
    // ==========================================

    try {

      response = await fetch(
        "https://reapi.ai/api/v1/tasks/" +
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

    // ==========================================
    // READ RESPONSE
    // ==========================================

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return json(502, {
        success: false,
        error: "reAPI imerudisha majibu yasiyo JSON"
      });
    }

    // ==========================================
    // HANDLE HTTP ERRORS
    // ==========================================

    if (!response.ok) {

      console.error("reAPI status error:", {
        httpStatus: response.status,
        apiCode:
          data?.error?.code ??
          data?.code ??
          null
      });

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

      return json(502, {
        success: false,
        error: "Imeshindikana kuangalia hali ya wimbo",
        http_status: response.status
      });
    }

    // ==========================================
    // READ TASK STATUS
    // ==========================================

    const root =
      data?.data &&
      typeof data.data === "object"
        ? data.data
        : data;

    const rawStatus = String(
      root?.status ||
      data?.status ||
      ""
    ).toLowerCase();

    // ==========================================
    // STATUS CATEGORIES
    // ==========================================

    const failedStates = [
      "failed",
      "failure",
      "error",
      "cancelled",
      "canceled"
    ];

    const completedStates = [
      "completed",
      "complete",
      "succeeded",
      "success"
    ];

    // ==========================================
    // VALIDATE AUDIO URL
    // ==========================================

    function safeURL(value) {

      if (typeof value !== "string") {
        return "";
      }

      try {

        const url = new URL(value);

        if (
          url.protocol === "https:" ||
          url.protocol === "http:"
        ) {
          return url.href;
        }

        return "";

      } catch {
        return "";
      }
    }

    // ==========================================
    // READ OUTPUT
    // ==========================================

    const output =
      root?.output &&
      typeof root.output === "object"
        ? root.output
        : {};

    const tracks = Array.isArray(output.tracks)
      ? output.tracks
      : [];

    const audioUrls = Array.isArray(output.audio_urls)
      ? output.audio_urls
      : [];

    // ==========================================
    // BUILD SONGS ARRAY
    // ==========================================

    const songs = [];

    const seenUrls = new Set();

    function addSong(title, audioUrl, duration) {

      const validUrl = safeURL(audioUrl);

      if (!validUrl || seenUrls.has(validUrl)) {
        return;
      }

      seenUrls.add(validUrl);

      const durationNumber = Number(duration);

      songs.push({
        title:
          typeof title === "string"
            ? title
            : "",
        audioUrl: validUrl,
        duration:
          Number.isFinite(durationNumber) &&
          durationNumber >= 0
            ? durationNumber
            : 0
      });
    }

    // ==========================================
    // EXTRACT TRACKS
    // ==========================================

    tracks.forEach((track, index) => {

      if (
        !track ||
        typeof track !== "object"
      ) {
        return;
      }

      addSong(
        track.title,
        track.url ||
          track.audio_url ||
          audioUrls[index],
        track.duration
      );

    });

    // ==========================================
    // FALLBACK: AUDIO URLS
    // ==========================================

    audioUrls.forEach((url, index) => {

      const track = tracks[index] || {};

      addSong(
        track.title,
        url,
        track.duration
      );

    });

    // ==========================================
    // DETERMINE FINAL STATUS
    // ==========================================

    let status = "processing";

    if (failedStates.includes(rawStatus)) {

      status = "failed";

    } else if (completedStates.includes(rawStatus)) {

      status =
        songs.length > 0
          ? "completed"
          : "processing";

    }

    // ==========================================
    // SAFE BACKEND LOG
    // ==========================================

    console.log("reAPI task status:", {
      taskId,
      rawStatus,
      status,
      songsFound: songs.length,
      tracksFound: tracks.length,
      audioUrlsFound: audioUrls.length
    });

    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================

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
            ? "Utengenezaji wa wimbo umeshindikana"
            : "Wimbo unaendelea kutengenezwa"
    });

  } catch (error) {

    // ==========================================
    // TIMEOUT
    // ==========================================

    if (error.name === "AbortError") {
      return json(504, {
        success: false,
        error: "reAPI imechelewa kujibu"
      });
    }

    // ==========================================
    // BACKEND ERROR
    // ==========================================

    console.error(
      "Status backend error:",
      error.name,
      error.message
    );

    return json(500, {
      success: false,
      error:
        "Tatizo limetokea wakati wa kuangalia wimbo"
    });

  }

};
